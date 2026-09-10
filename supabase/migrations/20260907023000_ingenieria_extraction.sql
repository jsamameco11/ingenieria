-- Motor de extracción Ingeniería / MemoriaCalc → perfil universal 360.
-- Extiende Folio. No duplica user_professions ni USER_ID.

insert into public.extraction_settings (key, value_num, value_text, description) values
  ('ingenieria_extractor_version', null, 'INGENIERIA-EXTRACTOR-1.0.0', 'Extractor de respuestas y cálculos'),
  ('ingenieria_taxonomy_version', null, 'tax-1.1.0-ingenieria', 'Taxonomía ingeniería + oficios MemoriaCalc'),
  ('observed_dedup_hours', 6, null, 'No repetir evidencia observada idéntica dentro de N horas'),
  ('answer_idempotency_hours', 24, null, 'Misma respuesta cruda no genera otra evidencia')
on conflict (key) do update
  set value_text = coalesce(excluded.value_text, public.extraction_settings.value_text),
      value_num = coalesce(excluded.value_num, public.extraction_settings.value_num),
      description = excluded.description,
      updated_at = now();

insert into public.data_sources (code, name, evidence_kind, description) values
  ('MEMORIACALC_DECLARED', 'Declaración en Ingeniería', 'declared', 'Onboarding, ficha y respuestas explícitas'),
  ('MEMORIACALC_EXTRACTED', 'Extracción estructurada Ingeniería', 'observed', 'Valor extraído de texto, no hecho verificado'),
  ('MEMORIACALC_OBSERVED', 'Uso observado en Ingeniería', 'observed', 'Módulos, cálculos y exportaciones; no es pericia'),
  ('MEMORIACALC_INFERRED', 'Inferencia Ingeniería', 'inferred', 'Nunca promover a declarado ni verificado'),
  ('PROFILE_FORM', 'Formulario de perfil', 'declared', 'Campos de onboarding'),
  ('CALCULATOR_USED', 'Hoja de cálculo usada', 'observed', 'Señal de uso, no de dominio experto')
on conflict (code) do nothing;

insert into public.engagement_weights (code, source_type, interaction_level, weight, description) values
  ('QUESTION_ANSWERED', 'QUESTION', 'EXPLICIT', 10.0, 'Respuesta explícita a una pregunta'),
  ('PROFILE_FORM', 'PROFILE', 'EXPLICIT', 10.0, 'Campo de onboarding'),
  ('CALCULATOR_USED', 'CALCULATOR', 'MEDIUM', 2.2, 'Ejecutó un cálculo'),
  ('CALCULATION_COMPLETED', 'CALCULATOR', 'MEDIUM', 2.4, 'Pulsó Calcular'),
  ('MODULE_VIEW', 'VIEW', 'LOW', 0.9, 'Abrió un módulo'),
  ('TEMPLATE_SELECTED', 'TEMPLATE', 'MEDIUM', 1.8, 'Eligió una plantilla'),
  ('TEMPLATE_REUSED', 'TEMPLATE', 'MEDIUM', 2.0, 'Reutilizó una plantilla'),
  ('DOCUMENT_EXPORTED', 'DOWNLOAD', 'MEDIUM', 2.0, 'Exportó Word o PDF'),
  ('FEATURE_USED', 'FEATURE', 'LOW', 1.1, 'Usó una función'),
  ('TOOL_USED', 'TOOL', 'MEDIUM', 1.6, 'Usó una herramienta (ETABS paste, Revit)'),
  ('SEARCH_PERFORMED', 'SEARCH', 'HIGH', 3.2, 'Búsqueda en la app'),
  ('COURSE_SELECTED', 'COURSE', 'HIGH', 3.0, 'Eligió un curso')
on conflict (code) do nothing;

insert into public.restricted_attributes (code, reason) values
  ('religion', 'No inferir religión'),
  ('race', 'No inferir raza'),
  ('ethnicity', 'No inferir etnia'),
  ('sexual_orientation', 'No inferir orientación sexual'),
  ('health_condition', 'No inferir salud'),
  ('political_affiliation', 'No inferir política'),
  ('ideology', 'No inferir ideología'),
  ('gender_identity', 'No inferir identidad de género'),
  ('password', 'Nunca extraer credenciales'),
  ('credential', 'Nunca extraer secretos'),
  ('third_party_private', 'No extraer datos de terceros'),
  ('financial_sensitive', 'No inferir finanzas sensibles'),
  ('intimate', 'No extraer información íntima')
on conflict (code) do nothing;

do $$
declare rec record;
begin
  for rec in
    select con.conname, pg_get_constraintdef(con.oid) as def
    from pg_constraint con
    where con.conrelid = 'public.extraction_evidence'::regclass
      and con.contype = 'c'
  loop
    if rec.def ilike '%evidence_kind%' then
      execute format('alter table public.extraction_evidence drop constraint %I', rec.conname);
    elsif rec.def ilike '%target_type%' then
      execute format('alter table public.extraction_evidence drop constraint %I', rec.conname);
    end if;
  end loop;
end $$;

alter table public.extraction_evidence
  add constraint extraction_evidence_evidence_kind_check
  check (evidence_kind in ('declared', 'extracted', 'observed', 'inferred', 'verified', 'imported', 'system'));

alter table public.extraction_evidence
  add constraint extraction_evidence_target_type_check
  check (target_type in (
    'interest', 'profession', 'skill', 'technology', 'education',
    'experience', 'intention', 'goal', 'preference', 'document_type',
    'keyword', 'entity', 'industry', 'identity', 'role', 'organization',
    'location', 'specialization'
  ));

-- Prioridad de fuentes configurable (menor rank = más autoridad).
create table if not exists public.source_priority (
  code text primary key,
  rank integer not null,
  description text not null
);

insert into public.source_priority (code, rank, description) values
  ('USER_EXPLICIT_DECLARATION', 10, 'El usuario lo escribió o eligió'),
  ('VERIFIED_DOCUMENT', 20, 'Documento verificado (nunca automático)'),
  ('PROFILE_FORM', 30, 'Formulario de perfil'),
  ('STRUCTURED_APPLICATION_DATA', 40, 'Dato estructurado de la app'),
  ('USER_INTERACTION', 50, 'Interacción voluntaria'),
  ('SYSTEM_OBSERVATION', 60, 'Observación de uso'),
  ('INFERENCE', 70, 'Inferencia; nunca hecho')
on conflict (code) do update set rank = excluded.rank, description = excluded.description;

create table if not exists public.entity_aliases (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null
    check (entity_type in ('profession', 'skill', 'technology', 'interest', 'role', 'industry')),
  alias_norm text not null,
  catalog_code text not null,
  confidence numeric(5, 4) not null default 0.95,
  unique (entity_type, alias_norm)
);

create table if not exists public.question_definitions (
  question_id text primary key,
  platform_code text not null default 'INGENIERIA',
  module_id text,
  question_text text not null,
  question_type text not null default 'text',
  data_category text not null,
  target_attribute text not null,
  data_type text not null default 'TEXT',
  required boolean not null default false,
  allow_multiple boolean not null default false,
  normalization_rule text,
  validation_rule text,
  sensitivity_level text not null default 'standard'
    check (sensitivity_level in ('public', 'standard', 'sensitive', 'forbidden')),
  extraction_enabled boolean not null default true,
  version text not null default 'q-1.0.0',
  created_at timestamptz not null default now()
);

create table if not exists public.user_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  platform_id uuid references public.platforms (id) on delete set null,
  question_id text not null references public.question_definitions (question_id) on delete restrict,
  module_id text,
  raw_answer text not null,
  normalized_answer jsonb not null default '{}'::jsonb,
  extracted_json jsonb not null default '{}'::jsonb,
  source_type text not null default 'QUESTION',
  fingerprint text not null,
  superseded_at timestamptz,
  extractor_version text not null default 'INGENIERIA-EXTRACTOR-1.0.0',
  created_at timestamptz not null default now()
);

create index if not exists user_answers_user_q_idx
  on public.user_answers (user_id, question_id, created_at desc);
create index if not exists user_answers_live_idx
  on public.user_answers (user_id, question_id)
  where superseded_at is null;

create table if not exists public.scoring_models (
  code text primary key,
  name text not null,
  is_active boolean not null default true,
  description text
);

create table if not exists public.scoring_model_versions (
  id uuid primary key default gen_random_uuid(),
  model_code text not null references public.scoring_models (code) on delete cascade,
  version text not null,
  formula_notes text not null,
  params jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (model_code, version)
);

create table if not exists public.scoring_rules (
  id uuid primary key default gen_random_uuid(),
  model_version_id uuid not null references public.scoring_model_versions (id) on delete cascade,
  rule_code text not null,
  factor text not null,
  coefficient numeric(8, 4) not null default 1,
  notes text,
  unique (model_version_id, rule_code)
);

create table if not exists public.profile_completeness (
  user_id uuid primary key references public.users (id) on delete cascade,
  identity_pct numeric(5, 2) not null default 0,
  profession_pct numeric(5, 2) not null default 0,
  experience_pct numeric(5, 2) not null default 0,
  education_pct numeric(5, 2) not null default 0,
  skills_pct numeric(5, 2) not null default 0,
  technologies_pct numeric(5, 2) not null default 0,
  specialization_pct numeric(5, 2) not null default 0,
  interests_pct numeric(5, 2) not null default 0,
  goals_pct numeric(5, 2) not null default 0,
  preferences_pct numeric(5, 2) not null default 0,
  overall_pct numeric(5, 2) not null default 0,
  missing jsonb not null default '[]'::jsonb,
  next_questions jsonb not null default '[]'::jsonb,
  model_version text not null default 'complete-v1',
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_completeness_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  overall_pct numeric(5, 2),
  snapshot jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now()
);

create table if not exists public.user_attribute_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  attribute_key text not null,
  previous_value text,
  new_value text,
  source_type text,
  question_id text,
  evidence_id uuid references public.extraction_evidence (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists user_attribute_history_user_idx
  on public.user_attribute_history (user_id, attribute_key, created_at desc);

create table if not exists public.extraction_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete cascade,
  platform_code text,
  extractor_version text,
  input_summary text,
  debug jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists extraction_logs_user_idx
  on public.extraction_logs (user_id, created_at desc);

insert into public.scoring_models (code, name, is_active, description) values
  ('interest-agg', 'Agregación de intereses', true, 'evidence + frequency + recency + depth + explicitness; no hardcode en cliente'),
  ('completeness-v1', 'Completitud de perfil', true, 'Porcentaje por dominio a partir de atributos con evidencia')
on conflict (code) do nothing;

insert into public.scoring_model_versions (model_code, version, formula_notes, params, is_active)
select 'interest-agg', 'v1',
  'score = 100 * (1 - exp(-k * sum(weight * confidence * recency_decay))). recency_decay = exp(-ln(2) * age_days / half_life). declared_score nunca se pisa con inferred.',
  jsonb_build_object(
    'half_life_days', coalesce(private.setting_num('recency_half_life_days', 90), 90),
    'saturation_k', coalesce(private.setting_num('saturation_k', 0.12), 0.12),
    'confidence_observed', coalesce(private.setting_num('confidence_observed', 0.50), 0.50)
  ),
  true
where not exists (
  select 1 from public.scoring_model_versions v
  where v.model_code = 'interest-agg' and v.version = 'v1'
);

insert into public.scoring_rules (model_version_id, rule_code, factor, coefficient, notes)
select v.id, r.rule_code, r.factor, r.coefficient, r.notes
from public.scoring_model_versions v
cross join (values
  ('evidence', 'evidence', 1.00, 'Peso base de cada evidencia'),
  ('frequency', 'frequency', 0.08, 'Saturación 100*(1-exp(-0.08*n))'),
  ('recency', 'recency', 1.00, 'Decay exponencial por half-life'),
  ('depth', 'depth', 1.00, 'interaction_level del peso'),
  ('explicitness', 'explicitness', 1.00, 'EXPLICIT = engagement_weights 10'),
  ('repetition', 'repetition', 1.00, 'Revisita no duplica si está dentro de la ventana'),
  ('source_reliability', 'source_reliability', 1.00, 'Rank de source_priority')
) as r(rule_code, factor, coefficient, notes)
where v.model_code = 'interest-agg' and v.version = 'v1'
on conflict do nothing;

-- Taxonomía de ingeniería (extiende seed Folio). Nunca chocar con slug único.
insert into public.professions (code, name, slug, description)
select v.code, v.name, v.slug, v.description
from (values
  ('arch', 'Arquitectura', 'arquitectura', 'Rama raíz'),
  ('tech-other', 'Otras profesiones técnicas', 'otras-tecnicas', 'Rama raíz')
) as v(code, name, slug, description)
where not exists (select 1 from public.professions x where x.code = v.code or x.slug = v.slug);

insert into public.professions (code, name, slug, parent_id)
select v.code, v.name, v.slug, p.id
from (values
  ('eng-mech', 'Ingeniería Mecánica', 'ingenieria-mecanica'),
  ('eng-elec', 'Ingeniería Eléctrica', 'ingenieria-electrica'),
  ('eng-ind', 'Ingeniería Industrial', 'ingenieria-industrial'),
  ('eng-san', 'Ingeniería Sanitaria', 'ingenieria-sanitaria'),
  ('eng-env', 'Ingeniería Ambiental', 'ingenieria-ambiental'),
  ('eng-sys', 'Ingeniería de Sistemas', 'ingenieria-sistemas'),
  ('eng-geo', 'Ingeniería Geológica', 'ingenieria-geologica'),
  ('eng-min', 'Ingeniería de Minas', 'ingenieria-minas'),
  ('eng-agr', 'Ingeniería Agrícola', 'ingenieria-agricola'),
  ('eng-chem', 'Ingeniería Química', 'ingenieria-quimica'),
  ('eng-electron', 'Ingeniería Electrónica', 'ingenieria-electronica')
) as v(code, name, slug)
join public.professions p on p.code = 'eng'
where not exists (select 1 from public.professions x where x.code = v.code or x.slug = v.slug);

insert into public.professions (code, name, slug, parent_id)
select v.code, v.name, v.slug, p.id
from (values
  ('eng-civil-geo', 'Geotecnia', 'geotecnia'),
  ('eng-civil-hid', 'Hidráulica', 'hidraulica'),
  ('eng-civil-hidro', 'Hidrología', 'hidrologia'),
  ('eng-civil-trans', 'Transportes', 'transportes'),
  ('eng-civil-pav', 'Pavimentos', 'pavimentos'),
  ('eng-civil-const', 'Construcción', 'construccion'),
  ('eng-civil-cost', 'Costos y presupuestos', 'costos-presupuestos'),
  ('eng-civil-plan', 'Planeamiento', 'planeamiento'),
  ('eng-civil-pm', 'Gestión de proyectos', 'gestion-proyectos'),
  ('eng-civil-san', 'Saneamiento', 'saneamiento'),
  ('eng-civil-top', 'Topografía', 'topografia'),
  ('eng-civil-mix', 'Diseño de mezclas', 'diseno-mezclas'),
  ('eng-civil-tas', 'Tasaciones', 'tasaciones'),
  ('eng-civil-inst', 'Instalaciones', 'instalaciones')
) as v(code, name, slug)
join public.professions p on p.code = 'eng-civil'
where not exists (select 1 from public.professions x where x.code = v.code or x.slug = v.slug);

insert into public.professions (code, name, slug, parent_id)
select v.code, v.name, v.slug, p.id
from (values
  ('eng-civil-est-concreto', 'Concreto armado', 'concreto-armado'),
  ('eng-civil-est-acero', 'Acero estructural', 'acero-estructural'),
  ('eng-civil-est-alba', 'Albañilería', 'albanileria'),
  ('eng-civil-est-madera', 'Madera', 'madera'),
  ('eng-civil-est-puentes', 'Puentes', 'puentes')
) as v(code, name, slug)
join public.professions p on p.code = 'eng-civil-est'
where not exists (select 1 from public.professions x where x.code = v.code or x.slug = v.slug);

insert into public.professions (code, name, slug, parent_id)
select v.code, v.name, v.slug, p.id
from (values
  ('arch-general', 'Arquitecto', 'arquitecto-profesional'),
  ('arch-urban', 'Urbanista', 'urbanista'),
  ('arch-paisaje', 'Arquitecto paisajista', 'arquitecto-paisajista'),
  ('arch-interior', 'Diseñador de interiores', 'disenador-interiores')
) as v(code, name, slug)
join public.professions p on p.code = 'arch'
where not exists (select 1 from public.professions x where x.code = v.code or x.slug = v.slug);

insert into public.interest_categories (code, name, slug, parent_id)
select v.code, v.name, v.slug, p.id
from (values
  ('eng-civil-geo', 'Geotecnia', 'geotecnia'),
  ('eng-civil-hid', 'Hidráulica', 'hidraulica'),
  ('eng-civil-hidro', 'Hidrología', 'hidrologia'),
  ('eng-civil-trans', 'Transportes y carreteras', 'transportes'),
  ('eng-civil-pav', 'Pavimentos', 'pavimentos'),
  ('eng-civil-const', 'Construcción', 'construccion'),
  ('eng-civil-cost', 'Presupuestos y APU', 'presupuestos'),
  ('eng-civil-pm', 'Gestión de proyectos', 'gestion-proyectos'),
  ('eng-civil-san', 'Agua y saneamiento', 'saneamiento'),
  ('eng-civil-top', 'Topografía', 'topografia'),
  ('eng-civil-mix', 'Diseño de mezclas', 'diseno-mezclas'),
  ('eng-civil-tas', 'Tasaciones', 'tasaciones'),
  ('eng-civil-inst', 'Instalaciones eléctricas', 'instalaciones'),
  ('eng-civil-puentes', 'Puentes', 'puentes'),
  ('eng-civil-mov', 'Movimiento de tierras', 'movimiento-tierras')
) as v(code, name, slug)
join public.interest_categories p on p.code = 'eng-civil'
where not exists (select 1 from public.interest_categories x where x.code = v.code or x.slug = v.slug);

insert into public.skills (code, name, slug)
select 'design', 'Diseño', 'diseno'
where not exists (select 1 from public.skills x where x.code = 'design' or x.slug = 'diseno');

insert into public.skills (code, name, slug, parent_id)
select v.code, v.name, v.slug, s.id
from (values
  ('eng-design-est', 'Diseño estructural', 'diseno-estructural'),
  ('eng-calc-est', 'Cálculo estructural', 'calculo-estructural'),
  ('eng-bim-mod', 'Modelamiento BIM', 'modelamiento-bim'),
  ('eng-budget', 'Presupuestos', 'presupuestos'),
  ('eng-metrado', 'Metrados', 'metrados'),
  ('eng-schedule', 'Programación de obra', 'programacion-obra'),
  ('eng-pm', 'Gestión de proyectos', 'gestion-proyectos'),
  ('eng-sup', 'Supervisión', 'supervision'),
  ('eng-hid-des', 'Diseño hidráulico', 'diseno-hidraulico'),
  ('eng-topo', 'Topografía', 'topografia'),
  ('eng-residente', 'Residencia de obra', 'residencia-obra'),
  ('eng-proy', 'Proyectista', 'proyectista')
) as v(code, name, slug)
join public.skills s on s.code = 'eng'
where not exists (select 1 from public.skills x where x.code = v.code or x.slug = v.slug);

insert into public.technology_catalog (code, name, slug, category)
select v.code, v.name, v.slug, v.category
from (values
  ('civil3d', 'Civil 3D', 'civil-3d', 'cad'),
  ('revit-structure', 'Revit Structure', 'revit-structure', 'cad'),
  ('revit-architecture', 'Revit Architecture', 'revit-architecture', 'cad'),
  ('safe', 'SAFE', 'safe', 'struct'),
  ('robot', 'Robot Structural Analysis', 'robot', 'struct'),
  ('tekla', 'Tekla', 'tekla', 'bim'),
  ('navisworks', 'Navisworks', 'navisworks', 'bim'),
  ('msproject', 'MS Project', 'ms-project', 'pm'),
  ('primavera', 'Primavera P6', 'primavera-p6', 'pm'),
  ('powerbi', 'Power BI', 'power-bi', 'bi'),
  ('matlab', 'MATLAB', 'matlab', 'lang')
) as v(code, name, slug, category)
where not exists (select 1 from public.technology_catalog x where x.code = v.code or x.slug = v.slug);

insert into public.entity_aliases (entity_type, alias_norm, catalog_code, confidence) values
  ('profession', 'ingeniero civil', 'eng-civil', 0.99),
  ('profession', 'ingenieria civil', 'eng-civil', 0.99),
  ('profession', 'ing civil', 'eng-civil', 0.98),
  ('profession', 'ing. civil', 'eng-civil', 0.98),
  ('profession', 'civil engineer', 'eng-civil', 0.97),
  ('profession', 'ingeniero estructural', 'eng-civil-est', 0.96),
  ('profession', 'ingenieria estructural', 'eng-civil-est', 0.96),
  ('profession', 'arquitecto', 'ARQ', 0.99),
  ('profession', 'arquitectura', 'ARQ', 0.98),
  ('profession', 'disenador de interiores', 'arch-interior', 0.97),
  ('profession', 'ingeniero mecanico', 'eng-mech', 0.98),
  ('profession', 'ingeniero electricista', 'eng-elec', 0.98),
  ('profession', 'ingeniero industrial', 'eng-ind', 0.98),
  ('profession', 'ingeniero sanitario', 'eng-san', 0.98),
  ('profession', 'ingeniero ambiental', 'eng-env', 0.98),
  ('profession', 'ingeniero de sistemas', 'eng-sys', 0.98),
  ('technology', 'etabs', 'etabs', 0.99),
  ('technology', 'csi etabs', 'etabs', 0.98),
  ('technology', 'etabs 21', 'etabs', 0.97),
  ('technology', 'sap2000', 'sap2000', 0.99),
  ('technology', 'sap 2000', 'sap2000', 0.98),
  ('technology', 'safe', 'safe', 0.99),
  ('technology', 'revit', 'revit', 0.99),
  ('technology', 'revit structure', 'revit-structure', 0.97),
  ('technology', 'autocad', 'autocad', 0.99),
  ('technology', 'auto cad', 'autocad', 0.97),
  ('technology', 'civil 3d', 'civil3d', 0.98),
  ('technology', 'civil3d', 'civil3d', 0.98),
  ('technology', 'excel', 'excel', 0.95),
  ('technology', 'ms project', 'msproject', 0.97),
  ('technology', 'primavera', 'primavera', 0.96),
  ('technology', 'primavera p6', 'primavera', 0.97),
  ('technology', 'python', 'python', 0.99),
  ('technology', 'bim', 'bim', 0.95),
  ('interest', 'estructuras', 'eng-civil-est', 0.98),
  ('interest', 'estructuras y edificaciones', 'eng-civil-est', 0.97),
  ('interest', 'geotecnia', 'eng-civil-geo', 0.98),
  ('interest', 'hidraulica', 'eng-civil-hid', 0.98),
  ('interest', 'hidrologia', 'eng-civil-hidro', 0.98),
  ('interest', 'saneamiento', 'eng-civil-san', 0.98),
  ('interest', 'pavimentos', 'eng-civil-pav', 0.98),
  ('interest', 'presupuestos', 'eng-civil-cost', 0.97),
  ('interest', 'bim', 'eng-civil-bim', 0.96),
  ('role', 'residente', 'eng-residente', 0.97),
  ('role', 'residente de obra', 'eng-residente', 0.98),
  ('role', 'proyectista', 'eng-proy', 0.97),
  ('role', 'supervisor', 'eng-sup', 0.97),
  ('role', 'calculista', 'eng-calc-est', 0.96),
  ('industry', 'construccion', 'const', 0.97),
  ('industry', 'constructora', 'const', 0.96)
on conflict (entity_type, alias_norm) do nothing;

insert into public.question_definitions (
  question_id, platform_code, module_id, question_text, question_type,
  data_category, target_attribute, data_type, required, allow_multiple,
  normalization_rule, validation_rule, sensitivity_level
) values
  ('q.craft_family', 'INGENIERIA', 'onboarding', '¿Cuál es su oficio?', 'select', 'professional', 'craft_family', 'TEXT', true, false, 'family', 'enum:ingeniero,arquitecto,interiores,otro', 'standard'),
  ('q.profession', 'INGENIERIA', 'onboarding', '¿Cuál es su profesión?', 'select', 'professional', 'profession', 'TEXT', true, false, 'profession_alias', 'catalog:professions', 'standard'),
  ('q.age', 'INGENIERIA', 'onboarding', '¿Qué edad tiene?', 'number', 'identity', 'age', 'NUMBER', false, false, 'integer', 'min:15 max:90', 'sensitive'),
  ('q.sex', 'INGENIERIA', 'onboarding', 'Sexo (opcional)', 'select', 'identity', 'sex', 'TEXT', false, false, 'declared_only', 'enum:or empty', 'sensitive'),
  ('q.experience_years', 'INGENIERIA', 'onboarding', '¿Cuántos años de experiencia tiene?', 'number', 'experience', 'years_of_experience', 'NUMBER', false, false, 'integer_years', 'min:0 max:70', 'standard'),
  ('q.phone', 'INGENIERIA', 'onboarding', 'Teléfono', 'text', 'identity', 'phone', 'TEXT', false, false, 'phone', 'optional', 'sensitive'),
  ('q.workplace_role', 'INGENIERIA', 'onboarding', '¿Cuál es su rol de ejercicio?', 'select', 'professional', 'workplace_role', 'TEXT', false, false, 'role_alias', 'catalog:roles', 'standard'),
  ('q.practice_mode', 'INGENIERIA', 'onboarding', '¿Cómo ejerce?', 'select', 'preference', 'practice_mode', 'TEXT', false, false, 'enum', 'enum:independiente,empresa,estado,academia,ong', 'standard'),
  ('q.cip', 'INGENIERIA', 'onboarding', 'CIP / colegiatura', 'text', 'professional', 'cip', 'TEXT', false, false, 'trim', 'not_verified_education', 'sensitive'),
  ('q.organization', 'INGENIERIA', 'onboarding', 'Organización', 'text', 'experience', 'organization', 'TEXT', false, false, 'trim', 'optional', 'standard'),
  ('q.university', 'INGENIERIA', 'onboarding', 'Universidad', 'text', 'education', 'university', 'TEXT', false, false, 'trim', 'declared_not_verified', 'standard'),
  ('q.country', 'INGENIERIA', 'onboarding', 'País', 'select', 'identity', 'country', 'TEXT', false, false, 'country', 'optional', 'standard'),
  ('q.department', 'INGENIERIA', 'onboarding', 'Departamento / región', 'select', 'identity', 'region', 'TEXT', false, false, 'trim', 'optional', 'standard'),
  ('q.province', 'INGENIERIA', 'onboarding', 'Provincia', 'select', 'identity', 'province', 'TEXT', false, false, 'trim', 'optional', 'standard'),
  ('q.district', 'INGENIERIA', 'onboarding', 'Distrito', 'select', 'identity', 'city', 'TEXT', false, false, 'trim', 'optional', 'standard'),
  ('q.specialty_focus', 'INGENIERIA', 'onboarding', '¿En qué rubros trabaja o se interesa?', 'checkbox', 'interest', 'specialty_focus', 'TEXT[]', false, true, 'interest_alias', 'catalog:interests', 'standard'),
  ('q.module_used', 'INGENIERIA', 'calculator', 'Módulo utilizado', 'event', 'interest', 'module_slug', 'TEXT', false, false, 'specialty_map', 'observed_only', 'standard'),
  ('q.software_observed', 'INGENIERIA', 'calculator', 'Software observado en la hoja', 'event', 'technology', 'technology', 'TEXT', false, false, 'tech_alias', 'observed_not_expert', 'standard'),
  ('q.calculation_completed', 'INGENIERIA', 'calculator', 'Cálculo completado', 'event', 'interest', 'calculation', 'TEXT', false, false, 'specialty_map', 'observed_only', 'standard'),
  ('q.document_exported', 'INGENIERIA', 'calculator', 'Documento exportado', 'event', 'interest', 'export', 'TEXT', false, false, 'specialty_map', 'observed_only', 'standard')
on conflict (question_id) do update
  set question_text = excluded.question_text,
      target_attribute = excluded.target_attribute,
      extraction_enabled = excluded.extraction_enabled;

create or replace function private.fold_alias(p text)
returns text
language sql
immutable
as $$
  select btrim(regexp_replace(
    translate(lower(coalesce(p, '')),
      'áéíóúüñàèìòùäëïöç',
      'aeiouunaeiouaeioc'),
    '[^a-z0-9]+', ' ', 'g'));
$$;

create or replace function public.resolve_entity_alias(p_type text, p_raw text)
returns text
language sql
stable
as $$
  select a.catalog_code
  from public.entity_aliases a
  where a.entity_type = p_type
    and a.alias_norm = private.fold_alias(p_raw)
  limit 1;
$$;

create or replace function public.submit_platform_extraction(
  p_platform_code text default 'INGENIERIA',
  p_source_type text default 'QUESTION',
  p_module_id text default null,
  p_answers jsonb default '[]'::jsonb,
  p_evidence jsonb default '[]'::jsonb,
  p_extractor_version text default 'INGENIERIA-EXTRACTOR-1.0.0',
  p_debug jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  uid uuid := auth.uid();
  pid uuid;
  src uuid;
  src_code text;
  item jsonb;
  ans jsonb;
  max_n int := least(coalesce(private.setting_num('max_evidence_per_submit', 80), 80), 120)::int;
  n int := 0;
  n_ans int := 0;
  code text;
  kind text;
  ttype text;
  qid text;
  raw text;
  fp text;
  prev_id uuid;
  prev_raw text;
  eid uuid;
  dedup_h numeric := coalesce(private.setting_num('observed_dedup_hours', 6), 6);
  wcode text;
begin
  if uid is null then
    raise exception 'Se requiere sesión.';
  end if;

  select p.id into pid from public.platforms p where p.platform_code = upper(btrim(coalesce(p_platform_code, 'INGENIERIA')));
  src_code := case upper(btrim(coalesce(p_source_type, 'QUESTION')))
    when 'QUESTION' then 'MEMORIACALC_DECLARED'
    when 'PROFILE' then 'PROFILE_FORM'
    when 'CALCULATOR' then 'CALCULATOR_USED'
    when 'EVENT' then 'MEMORIACALC_OBSERVED'
    when 'INFERENCE' then 'MEMORIACALC_INFERRED'
    else 'MEMORIACALC_EXTRACTED'
  end;
  select d.id into src from public.data_sources d where d.code = src_code;

  for ans in select value from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) loop
    qid := left(btrim(coalesce(ans ->> 'question_id', '')), 80);
    raw := left(coalesce(ans ->> 'raw_answer', ''), 2000);
    if qid = '' or btrim(raw) = '' then continue; end if;
    if not exists (select 1 from public.question_definitions q where q.question_id = qid and q.extraction_enabled) then
      continue;
    end if;
    fp := md5(uid::text || ':' || qid || ':' || lower(btrim(raw)));
    select a.id, a.raw_answer into prev_id, prev_raw
      from public.user_answers a
      where a.user_id = uid and a.question_id = qid and a.superseded_at is null
      order by a.created_at desc
      limit 1;
    if prev_id is not null and lower(btrim(prev_raw)) = lower(btrim(raw)) then
      continue;
    end if;
    if prev_id is not null then
      update public.user_answers set superseded_at = now() where id = prev_id;
      insert into public.user_attribute_history (user_id, attribute_key, previous_value, new_value, source_type, question_id)
      values (uid, qid, left(prev_raw, 280), left(raw, 280), coalesce(p_source_type, 'QUESTION'), qid);
    end if;
    insert into public.user_answers (
      user_id, platform_id, question_id, module_id, raw_answer, normalized_answer,
      extracted_json, source_type, fingerprint, extractor_version
    ) values (
      uid, pid, qid, left(coalesce(p_module_id, ans ->> 'module_id', ''), 80),
      raw, coalesce(ans -> 'normalized', '{}'::jsonb),
      coalesce(ans -> 'extracted', '{}'::jsonb),
      coalesce(nullif(ans ->> 'source_type', ''), p_source_type, 'QUESTION'),
      fp, coalesce(p_extractor_version, 'INGENIERIA-EXTRACTOR-1.0.0')
    );
    n_ans := n_ans + 1;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(p_evidence, '[]'::jsonb)) loop
    exit when n >= max_n;
    code := left(lower(btrim(coalesce(item ->> 'catalog_code', ''))), 80);
    if code = '' then continue; end if;
    if exists (select 1 from public.restricted_attributes r where r.code = code) then
      continue;
    end if;
    kind := coalesce(nullif(item ->> 'evidence_kind', ''), 'extracted');
    if kind not in ('declared', 'extracted', 'observed', 'inferred', 'verified', 'imported', 'system') then
      kind := 'extracted';
    end if;
    if kind = 'verified' then
      kind := 'declared';
    end if;
    ttype := coalesce(nullif(item ->> 'target_type', ''), 'keyword');
    if ttype not in (
      'interest', 'profession', 'skill', 'technology', 'education',
      'experience', 'intention', 'goal', 'preference', 'document_type',
      'keyword', 'entity', 'industry', 'identity', 'role', 'organization',
      'location', 'specialization'
    ) then
      ttype := 'keyword';
    end if;
    wcode := coalesce(nullif(item ->> 'weight_code', ''), 'QUESTION_ANSWERED');
    if kind = 'observed' and exists (
      select 1 from public.extraction_evidence e
      where e.user_id = uid and e.catalog_code = code and e.weight_code = wcode
        and e.retracted_at is null and e.evidence_kind = 'observed'
        and e.created_at > now() - (dedup_h || ' hours')::interval
    ) then
      continue;
    end if;

    insert into public.extraction_evidence (
      user_id, platform_id, evidence_kind, target_type, catalog_code,
      strength, confidence, evidence_text, source_type, interaction_level,
      weight_code, rule_id, extractor_version, source_id
    )
    values (
      uid, pid, kind, ttype, code,
      least(1, greatest(0, coalesce((item ->> 'strength')::numeric, 0))),
      least(1, greatest(0, coalesce((item ->> 'confidence')::numeric, 0))),
      private.redact_evidence_text(item ->> 'evidence_text'),
      coalesce(nullif(item ->> 'source_type', ''), coalesce(p_source_type, 'QUESTION')),
      coalesce(nullif(item ->> 'interaction_level', ''), 'EXPLICIT'),
      wcode,
      left(coalesce(item ->> 'rule_id', ''), 80),
      coalesce(p_extractor_version, 'INGENIERIA-EXTRACTOR-1.0.0'),
      src
    )
    returning id into eid;
    n := n + 1;
  end loop;

  if p_debug is not null and p_debug <> '{}'::jsonb then
    insert into public.extraction_logs (user_id, platform_code, extractor_version, input_summary, debug)
    values (
      uid, upper(btrim(coalesce(p_platform_code, 'INGENIERIA'))),
      coalesce(p_extractor_version, 'INGENIERIA-EXTRACTOR-1.0.0'),
      left(coalesce(p_debug ->> 'input', ''), 280),
      p_debug
    );
  end if;

  perform public.apply_declared_profile_from_evidence(uid);
  return public.aggregate_user_profile_from_evidence(uid)
    || public.recalculate_profile_completeness(uid)
    || jsonb_build_object('answers_stored', n_ans, 'evidence_stored', n, 'platform', upper(btrim(coalesce(p_platform_code, 'INGENIERIA'))));
end;
$$;

create or replace function public.apply_declared_profile_from_evidence(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  src uuid;
  prim uuid;
  new_prof uuid;
  old_name text;
  new_name text;
begin
  select d.id into src from public.data_sources d where d.code = 'MEMORIACALC_DECLARED';

  insert into public.user_professions (user_id, profession_id, is_primary, confidence_score, verified, source_id)
  select p_user, p.id, false, least(100, avg(e.confidence) * 100), false, src
  from public.extraction_evidence e
  join public.professions p on p.code = e.catalog_code
  where e.user_id = p_user and e.retracted_at is null and e.target_type = 'profession'
    and e.evidence_kind in ('declared', 'extracted')
  group by p.id
  on conflict (user_id, profession_id) do update
    set confidence_score = greatest(public.user_professions.confidence_score, excluded.confidence_score),
        verified = public.user_professions.verified;

  select pp.primary_profession_id into prim
    from public.user_professional_profiles pp where pp.user_id = p_user;

  select p.id, p.name into new_prof, new_name
  from public.extraction_evidence e
  join public.professions p on p.code = e.catalog_code
  where e.user_id = p_user and e.retracted_at is null and e.target_type = 'profession'
    and e.evidence_kind = 'declared'
  order by e.confidence desc, e.created_at desc
  limit 1;

  if new_prof is not null and prim is null then
    insert into public.user_professional_profiles (user_id, primary_profession_id)
    values (p_user, new_prof)
    on conflict (user_id) do update
      set primary_profession_id = excluded.primary_profession_id
      where public.user_professional_profiles.primary_profession_id is null;
    update public.user_professions
      set is_primary = (profession_id = new_prof)
      where user_id = p_user;
  elsif new_prof is not null and prim is not null and prim is distinct from new_prof then
    select pr.name into old_name from public.professions pr where pr.id = prim;
    insert into public.extraction_conflicts (user_id, field_name, declared_value, observed_value, status)
    values (p_user, 'profession', coalesce(old_name, prim::text), coalesce(new_name, new_prof::text), 'open')
    on conflict do nothing;
  end if;

  insert into public.user_interests (
    user_id, interest_id, declared_score, interest_score, confidence_score, status, source_id, last_seen_at, calculated_at, score_version
  )
  select p_user, ic.id, least(100, avg(e.confidence) * 100), least(100, avg(e.confidence) * 100),
         least(100, avg(e.confidence) * 100), 'active', src, max(e.created_at), now(), 'declared-v1'
  from public.extraction_evidence e
  join public.interest_categories ic on ic.code = e.catalog_code
  where e.user_id = p_user and e.retracted_at is null and e.target_type = 'interest'
    and e.evidence_kind = 'declared'
  group by ic.id
  on conflict (user_id, interest_id) do update
    set declared_score = greatest(coalesce(public.user_interests.declared_score, 0), excluded.declared_score),
        interest_score = coalesce(
          greatest(coalesce(public.user_interests.declared_score, 0), excluded.declared_score),
          public.user_interests.verified_score,
          public.user_interests.interest_score
        ),
        confidence_score = excluded.confidence_score,
        last_seen_at = excluded.last_seen_at;

  insert into public.user_skills (user_id, skill_id, declared_score, confidence_score, source_id, last_seen_at)
  select p_user, s.id, least(100, avg(e.confidence) * 100), least(100, avg(e.confidence) * 100), src, max(e.created_at)
  from public.extraction_evidence e
  join public.skills s on s.code = e.catalog_code
  where e.user_id = p_user and e.retracted_at is null and e.target_type in ('skill', 'role')
    and e.evidence_kind in ('declared', 'extracted')
  group by s.id
  on conflict (user_id, skill_id) do update
    set declared_score = greatest(coalesce(public.user_skills.declared_score, 0), excluded.declared_score),
        last_seen_at = excluded.last_seen_at;

  insert into public.user_technologies (user_id, technology_id, usage_score, proficiency_score, last_seen_at, source_id)
  select p_user, t.id, least(100, avg(e.strength) * 100),
         case when min(e.evidence_kind) filter (where e.evidence_kind = 'declared') is not null
           then least(100, avg(e.confidence) * 100) else null end,
         max(e.created_at), src
  from public.extraction_evidence e
  join public.technology_catalog t on t.code = e.catalog_code
  where e.user_id = p_user and e.retracted_at is null and e.target_type = 'technology'
  group by t.id
  on conflict (user_id, technology_id) do update
    set usage_score = excluded.usage_score,
        last_seen_at = excluded.last_seen_at,
        proficiency_score = coalesce(public.user_technologies.proficiency_score, excluded.proficiency_score);

  insert into public.user_preferences (user_id, category, preference_key, preference_value, declared, confidence_score, source_id)
  select p_user, 'professional', e.catalog_code, left(e.evidence_text, 120), true, e.confidence * 100, src
  from public.extraction_evidence e
  where e.user_id = p_user and e.retracted_at is null and e.target_type = 'preference'
    and e.evidence_kind = 'declared'
  on conflict (user_id, category, preference_key) do update
    set preference_value = excluded.preference_value,
        declared = true,
        inferred = false;

  insert into public.user_goals (user_id, goal_type, title, status, source_id)
  select p_user, e.catalog_code, left(coalesce(e.evidence_text, e.catalog_code), 160), 'active', src
  from public.extraction_evidence e
  where e.user_id = p_user and e.retracted_at is null and e.target_type = 'goal'
    and e.evidence_kind in ('declared', 'extracted')
    and not exists (
      select 1 from public.user_goals g
      where g.user_id = p_user and g.title = left(coalesce(e.evidence_text, e.catalog_code), 160) and g.status = 'active'
    );

  update public.user_professional_profiles pp
  set years_of_experience = coalesce(sub.years, pp.years_of_experience),
      specialization_summary = coalesce(pp.specialization_summary, sub.spec)
  from (
    select
      (
        select (e.evidence_text)::numeric
        from public.extraction_evidence e
        where e.user_id = p_user and e.retracted_at is null
          and e.target_type = 'experience' and e.catalog_code = 'years_of_experience'
          and e.evidence_kind in ('declared', 'extracted')
          and e.evidence_text ~ '^[0-9]+(\.[0-9]+)?$'
        order by e.created_at desc
        limit 1
      ) as years,
      (
        select string_agg(distinct e.catalog_code, ', ')
        from public.extraction_evidence e
        where e.user_id = p_user and e.retracted_at is null and e.target_type = 'specialization'
      ) as spec
  ) sub
  where pp.user_id = p_user;
end;
$$;

create or replace function public.recalculate_profile_completeness(p_user uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  uid uuid := coalesce(p_user, auth.uid());
  ident numeric := 0;
  prof numeric := 0;
  exp numeric := 0;
  edu numeric := 0;
  sk numeric := 0;
  tech numeric := 0;
  spec numeric := 0;
  inte numeric := 0;
  gol numeric := 0;
  pref numeric := 0;
  overall numeric := 0;
  missing jsonb := '[]'::jsonb;
  nextq jsonb := '[]'::jsonb;
begin
  if uid is null then raise exception 'Se requiere sesión.'; end if;
  if auth.uid() is not null and auth.uid() is distinct from uid and not private.is_admin() then
    raise exception 'No autorizado.';
  end if;

  ident := least(100,
    (select case when display_name is not null and display_name <> '' then 50 else 0 end from public.user_profiles where user_id = uid)
    + (select case when country_id is not null then 50 else 0 end from public.users where id = uid)
  );
  if ident < 50 then
    missing := missing || '["identity"]'::jsonb;
  end if;

  prof := case when exists (
    select 1 from public.user_professions where user_id = uid
  ) or exists (
    select 1 from public.user_professional_profiles where user_id = uid and primary_profession_id is not null
  ) then 100 else 0 end;
  if prof < 100 then
    missing := missing || '["profession"]'::jsonb;
    nextq := nextq || '[{"question_id":"q.profession","text":"¿Cuál es tu profesión?"}]'::jsonb;
  end if;

  exp := least(100,
    (select case when years_of_experience is not null then 60 else 0 end from public.user_professional_profiles where user_id = uid)
    + (select case when count(*) > 0 then 40 else 0 end from public.user_work_experience where user_id = uid)
  );
  if (select years_of_experience from public.user_professional_profiles where user_id = uid) is null then
    missing := missing || '["experience"]'::jsonb;
    nextq := nextq || '[{"question_id":"q.experience_years","text":"¿Cuántos años de experiencia tienes?"}]'::jsonb;
  end if;

  edu := case when exists (select 1 from public.user_education where user_id = uid) then 100
    when exists (
      select 1 from public.user_answers a
      where a.user_id = uid and a.question_id = 'q.university' and a.superseded_at is null and btrim(a.raw_answer) <> ''
    ) then 80 else 0 end;
  if edu < 60 then
    missing := missing || '["education"]'::jsonb;
    nextq := nextq || '[{"question_id":"q.university","text":"¿En qué universidad estudiaste?"}]'::jsonb;
  end if;

  sk := least(100, (select count(*) * 35 from public.user_skills where user_id = uid));
  tech := least(100, (select count(*) * 35 from public.user_technologies where user_id = uid));
  spec := case when exists (
    select 1 from public.extraction_evidence e
    where e.user_id = uid and e.retracted_at is null and e.target_type = 'specialization'
  ) then 100 when exists (
    select 1 from public.user_interests where user_id = uid and declared_score is not null
  ) then 70 else 0 end;
  inte := least(100, (select count(*) * 25 from public.user_interests where user_id = uid and status = 'active'));
  gol := case when exists (select 1 from public.user_goals where user_id = uid and status = 'active') then 100 else 0 end;
  pref := least(100, (select count(*) * 40 from public.user_preferences where user_id = uid and declared));

  if inte < 40 then
    missing := missing || '["interests"]'::jsonb;
    nextq := nextq || '[{"question_id":"q.specialty_focus","text":"¿En qué especialidades trabajas?"}]'::jsonb;
  end if;
  if tech < 35 then
    missing := missing || '["technologies"]'::jsonb;
    nextq := nextq || '[{"question_id":"q.software_observed","text":"¿Qué software utilizas en tu trabajo?"}]'::jsonb;
  end if;

  overall := round((ident + prof + exp + edu + sk + tech + spec + inte + gol + pref) / 10.0, 2);

  insert into public.profile_completeness (
    user_id, identity_pct, profession_pct, experience_pct, education_pct, skills_pct,
    technologies_pct, specialization_pct, interests_pct, goals_pct, preferences_pct,
    overall_pct, missing, next_questions, updated_at
  ) values (
    uid, ident, prof, exp, edu, sk, tech, spec, inte, gol, pref, overall, missing, nextq, now()
  )
  on conflict (user_id) do update
    set identity_pct = excluded.identity_pct,
        profession_pct = excluded.profession_pct,
        experience_pct = excluded.experience_pct,
        education_pct = excluded.education_pct,
        skills_pct = excluded.skills_pct,
        technologies_pct = excluded.technologies_pct,
        specialization_pct = excluded.specialization_pct,
        interests_pct = excluded.interests_pct,
        goals_pct = excluded.goals_pct,
        preferences_pct = excluded.preferences_pct,
        overall_pct = excluded.overall_pct,
        missing = excluded.missing,
        next_questions = excluded.next_questions,
        updated_at = now();

  insert into public.profile_completeness_history (user_id, overall_pct, snapshot)
  values (uid, overall, jsonb_build_object(
    'identity', ident, 'profession', prof, 'experience', exp, 'education', edu,
    'skills', sk, 'technologies', tech, 'specialization', spec, 'interests', inte,
    'goals', gol, 'preferences', pref
  ));

  return jsonb_build_object('ok', true, 'completeness', overall, 'missing', missing, 'next_questions', nextq);
end;
$$;

create or replace function public.get_user_360_bundle(p_user uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  uid uuid := coalesce(p_user, auth.uid());
  out jsonb;
begin
  if uid is null then raise exception 'Se requiere sesión.'; end if;
  if auth.uid() is not null and auth.uid() is distinct from uid and not private.is_admin() then
    raise exception 'No autorizado.';
  end if;

  select jsonb_build_object(
    'identity', jsonb_build_object(
      'user_id', u.id,
      'public_user_code', u.public_user_code,
      'display_name', p.display_name,
      'first_name', p.first_name,
      'last_name', p.last_name,
      'phone', p.phone,
      'gender', p.gender,
      'birth_date', p.birth_date,
      'language', u.preferred_language,
      'timezone', u.timezone,
      'onboarding_completed', u.onboarding_completed
    ),
    'professional', jsonb_build_object(
      'headline', pp.professional_headline,
      'primary_profession', pr.name,
      'primary_profession_code', pr.code,
      'years_of_experience', pp.years_of_experience,
      'specialization_summary', pp.specialization_summary,
      'industry', ind.name,
      'level', pp.professional_level
    ),
    'education', coalesce((
      select jsonb_agg(jsonb_build_object(
        'institution_id', e.institution_id, 'field_of_study', e.field_of_study,
        'degree', e.degree, 'verified', e.verified, 'current', e.current
      )) from public.user_education e where e.user_id = uid
    ), '[]'::jsonb),
    'experience', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', w.position, 'current', w.current, 'employment_type', w.employment_type,
        'start_date', w.start_date, 'end_date', w.end_date, 'verified', w.verified
      ) order by w.current desc, w.start_date desc)
      from public.user_work_experience w where w.user_id = uid
    ), '[]'::jsonb),
    'skills', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', s.code, 'name', s.name, 'declared', us.declared_score,
        'observed', us.observed_score, 'inferred', us.inferred_score, 'confidence', us.confidence_score
      )) from public.user_skills us join public.skills s on s.id = us.skill_id where us.user_id = uid
    ), '[]'::jsonb),
    'technologies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', t.code, 'name', t.name, 'usage_score', ut.usage_score,
        'proficiency_score', ut.proficiency_score, 'last_seen_at', ut.last_seen_at
      )) from public.user_technologies ut join public.technology_catalog t on t.id = ut.technology_id
      where ut.user_id = uid
    ), '[]'::jsonb),
    'specializations', coalesce((
      select jsonb_agg(distinct e.catalog_code)
      from public.extraction_evidence e
      where e.user_id = uid and e.retracted_at is null and e.target_type = 'specialization'
    ), '[]'::jsonb),
    'interests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', ic.code, 'name', ic.name, 'score', coalesce(ui.declared_score, ui.verified_score, ui.observed_score, ui.inferred_score),
        'declared_score', ui.declared_score, 'observed_score', ui.observed_score,
        'inferred_score', ui.inferred_score, 'confidence', ui.confidence_score
      ) order by coalesce(ui.declared_score, ui.observed_score, 0) desc)
      from public.user_interests ui
      join public.interest_categories ic on ic.id = ui.interest_id
      where ui.user_id = uid and ui.status = 'active'
    ), '[]'::jsonb),
    'goals', coalesce((
      select jsonb_agg(jsonb_build_object('type', g.goal_type, 'title', g.title, 'status', g.status))
      from public.user_goals g where g.user_id = uid
    ), '[]'::jsonb),
    'preferences', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', prf.preference_key, 'value', prf.preference_value, 'declared', prf.declared, 'inferred', prf.inferred
      )) from public.user_preferences prf where prf.user_id = uid
    ), '[]'::jsonb),
    'work_history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'attribute_key', h.attribute_key, 'previous_value', h.previous_value,
        'new_value', h.new_value, 'created_at', h.created_at
      ) order by h.created_at desc)
      from public.user_attribute_history h where h.user_id = uid
    ), '[]'::jsonb),
    'conflicts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'field', c.field_name, 'declared', c.declared_value, 'other', c.observed_value, 'status', c.status
      )) from public.extraction_conflicts c where c.user_id = uid and c.status = 'open'
    ), '[]'::jsonb),
    'profile_completeness', to_jsonb(pc),
    'confidence', jsonb_build_object(
      'note', 'confidence ≠ interest_score',
      'extractor_version', (select value_text from public.extraction_settings where key = 'ingenieria_extractor_version'),
      'taxonomy_version', (select value_text from public.extraction_settings where key = 'ingenieria_taxonomy_version')
    )
  ) into out
  from public.users u
  left join public.user_profiles p on p.user_id = u.id
  left join public.user_professional_profiles pp on pp.user_id = u.id
  left join public.professions pr on pr.id = pp.primary_profession_id
  left join public.industries ind on ind.id = pp.industry_id
  left join public.profile_completeness pc on pc.user_id = u.id
  where u.id = uid;

  return coalesce(out, jsonb_build_object('ok', false, 'message', 'Usuario no encontrado'));
end;
$$;

create or replace function public.get_profile_evidence(p_user uuid default null, p_limit integer default 80)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  uid uuid := coalesce(p_user, auth.uid());
begin
  if uid is null then raise exception 'Se requiere sesión.'; end if;
  if auth.uid() is not null and auth.uid() is distinct from uid and not private.is_admin() then
    raise exception 'No autorizado.';
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(x))
    from (
      select e.id, e.target_type, e.catalog_code, e.evidence_kind, e.confidence, e.strength,
             e.evidence_text, e.source_type, e.weight_code, e.extractor_version, e.created_at,
             e.rule_id
      from public.extraction_evidence e
      where e.user_id = uid and e.retracted_at is null
      order by e.created_at desc
      limit least(greatest(coalesce(p_limit, 80), 1), 200)
    ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.retract_answer_evidence(p_answer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  uid uuid := auth.uid();
  qid text;
  raw text;
begin
  if uid is null then raise exception 'Se requiere sesión.'; end if;
  select question_id, raw_answer into qid, raw from public.user_answers where id = p_answer_id and user_id = uid;
  if qid is null then raise exception 'Respuesta no encontrada.'; end if;
  update public.user_answers set superseded_at = now() where id = p_answer_id and user_id = uid;
  update public.extraction_evidence
    set retracted_at = now()
    where user_id = uid and retracted_at is null
      and evidence_text = private.redact_evidence_text(raw);
  return public.aggregate_user_profile_from_evidence(uid)
    || public.recalculate_profile_completeness(uid)
    || jsonb_build_object('retracted_answer', p_answer_id);
end;
$$;

create or replace function public.record_work_role_change(
  p_position text,
  p_organization text default null,
  p_source text default 'DECLARED'
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  uid uuid := auth.uid();
  src uuid;
  prev text;
begin
  if uid is null then raise exception 'Se requiere sesión.'; end if;
  if btrim(coalesce(p_position, '')) = '' then
    return jsonb_build_object('ok', false);
  end if;
  select d.id into src from public.data_sources d where d.code = 'MEMORIACALC_DECLARED';
  select w.position into prev
    from public.user_work_experience w
    where w.user_id = uid and w.current
    order by w.updated_at desc
    limit 1;
  if prev is not null and lower(btrim(prev)) = lower(btrim(p_position)) then
    return jsonb_build_object('ok', true, 'unchanged', true);
  end if;
  update public.user_work_experience
    set current = false, end_date = coalesce(end_date, current_date), updated_at = now()
    where user_id = uid and current;
  insert into public.user_work_experience (user_id, position, location, current, employment_type, start_date, source_id, verified)
  values (uid, left(p_position, 160), left(coalesce(p_organization, ''), 160), true, p_source, current_date, src, false);
  insert into public.user_attribute_history (user_id, attribute_key, previous_value, new_value, source_type)
  values (uid, 'workplace_role', prev, left(p_position, 160), p_source);
  return jsonb_build_object('ok', true, 'previous', prev, 'current', p_position);
end;
$$;

create or replace function public.explain_interest_score(p_catalog_code text, p_user uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  uid uuid := coalesce(p_user, auth.uid());
  half_life numeric := private.setting_num('recency_half_life_days', 90);
begin
  if uid is null then raise exception 'Se requiere sesión.'; end if;
  if auth.uid() is not null and auth.uid() is distinct from uid and not private.is_admin() then
    raise exception 'No autorizado.';
  end if;
  return jsonb_build_object(
    'catalog_code', p_catalog_code,
    'contributions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'evidence_id', e.id,
        'kind', e.evidence_kind,
        'weight_code', e.weight_code,
        'confidence', e.confidence,
        'raw_weight', coalesce(w.weight, 0.5) * e.confidence,
        'decayed_weight', coalesce(w.weight, 0.5) * e.confidence
          * exp(-ln(2) * (extract(epoch from (now() - e.created_at)) / 86400.0) / nullif(half_life, 0)),
        'text', e.evidence_text,
        'created_at', e.created_at
      ) order by e.created_at desc)
      from public.extraction_evidence e
      left join public.engagement_weights w on w.code = e.weight_code and w.is_active
      where e.user_id = uid and e.retracted_at is null
        and e.catalog_code = lower(btrim(p_catalog_code))
    ), '[]'::jsonb),
    'model', (select jsonb_build_object('code', model_code, 'version', version, 'params', params)
              from public.scoring_model_versions where model_code = 'interest-agg' and is_active limit 1)
  );
end;
$$;

revoke all on function public.submit_platform_extraction(text, text, text, jsonb, jsonb, text, jsonb) from public;
grant execute on function public.submit_platform_extraction(text, text, text, jsonb, jsonb, text, jsonb) to authenticated;
revoke all on function public.get_user_360_bundle(uuid) from public;
grant execute on function public.get_user_360_bundle(uuid) to authenticated;
revoke all on function public.get_profile_evidence(uuid, integer) from public;
grant execute on function public.get_profile_evidence(uuid, integer) to authenticated;
revoke all on function public.recalculate_profile_completeness(uuid) from public;
grant execute on function public.recalculate_profile_completeness(uuid) to authenticated;
revoke all on function public.retract_answer_evidence(uuid) from public;
grant execute on function public.retract_answer_evidence(uuid) to authenticated;
revoke all on function public.record_work_role_change(text, text, text) from public;
grant execute on function public.record_work_role_change(text, text, text) to authenticated;
revoke all on function public.explain_interest_score(text, uuid) from public;
grant execute on function public.explain_interest_score(text, uuid) to authenticated;
revoke all on function public.resolve_entity_alias(text, text) from public;
grant execute on function public.resolve_entity_alias(text, text) to authenticated;

alter table public.question_definitions enable row level security;
alter table public.user_answers enable row level security;
alter table public.entity_aliases enable row level security;
alter table public.scoring_models enable row level security;
alter table public.scoring_model_versions enable row level security;
alter table public.scoring_rules enable row level security;
alter table public.profile_completeness enable row level security;
alter table public.profile_completeness_history enable row level security;
alter table public.user_attribute_history enable row level security;
alter table public.extraction_logs enable row level security;
alter table public.source_priority enable row level security;

drop policy if exists question_definitions_read on public.question_definitions;
create policy question_definitions_read on public.question_definitions for select to authenticated using (true);
drop policy if exists entity_aliases_read on public.entity_aliases;
create policy entity_aliases_read on public.entity_aliases for select to authenticated using (true);
drop policy if exists scoring_models_read on public.scoring_models;
create policy scoring_models_read on public.scoring_models for select to authenticated using (true);
drop policy if exists scoring_versions_read on public.scoring_model_versions;
create policy scoring_versions_read on public.scoring_model_versions for select to authenticated using (true);
drop policy if exists scoring_rules_read on public.scoring_rules;
create policy scoring_rules_read on public.scoring_rules for select to authenticated using (true);
drop policy if exists source_priority_read on public.source_priority;
create policy source_priority_read on public.source_priority for select to authenticated using (true);

drop policy if exists user_answers_own on public.user_answers;
create policy user_answers_own on public.user_answers
  for all to authenticated using (user_id = auth.uid() or private.is_admin())
  with check (user_id = auth.uid() or private.is_admin());
drop policy if exists profile_completeness_own on public.profile_completeness;
create policy profile_completeness_own on public.profile_completeness
  for select to authenticated using (user_id = auth.uid() or private.is_admin());
drop policy if exists profile_completeness_history_own on public.profile_completeness_history;
create policy profile_completeness_history_own on public.profile_completeness_history
  for select to authenticated using (user_id = auth.uid() or private.is_admin());
drop policy if exists user_attribute_history_own on public.user_attribute_history;
create policy user_attribute_history_own on public.user_attribute_history
  for select to authenticated using (user_id = auth.uid() or private.is_admin());
drop policy if exists extraction_logs_own on public.extraction_logs;
create policy extraction_logs_own on public.extraction_logs
  for select to authenticated using (user_id = auth.uid() or private.is_admin());

grant select on public.question_definitions, public.entity_aliases, public.scoring_models,
  public.scoring_model_versions, public.scoring_rules, public.source_priority to authenticated;
grant select, insert, update on public.user_answers to authenticated;
grant select on public.profile_completeness, public.profile_completeness_history,
  public.user_attribute_history, public.extraction_logs to authenticated;
grant all on public.question_definitions, public.user_answers, public.entity_aliases,
  public.scoring_models, public.scoring_model_versions, public.scoring_rules,
  public.profile_completeness, public.profile_completeness_history,
  public.user_attribute_history, public.extraction_logs, public.source_priority to service_role;
