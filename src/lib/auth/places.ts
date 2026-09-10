export type Country = { code: string; name: string };

export const COUNTRIES: Country[] = [
  { code: "PE", name: "Perú" },
  { code: "BO", name: "Bolivia" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "EC", name: "Ecuador" },
  { code: "AR", name: "Argentina" },
  { code: "BR", name: "Brasil" },
  { code: "PY", name: "Paraguay" },
  { code: "UY", name: "Uruguay" },
  { code: "VE", name: "Venezuela" },
  { code: "MX", name: "México" },
  { code: "PA", name: "Panamá" },
  { code: "CR", name: "Costa Rica" },
  { code: "GT", name: "Guatemala" },
  { code: "HN", name: "Honduras" },
  { code: "NI", name: "Nicaragua" },
  { code: "SV", name: "El Salvador" },
  { code: "DO", name: "República Dominicana" },
  { code: "CU", name: "Cuba" },
  { code: "US", name: "Estados Unidos" },
  { code: "ES", name: "España" },
  { code: "OT", name: "Otro país" },
];

/** INEI: departamento → provincia → distritos (capitales y núcleos urbanos). */
export const PERU: Record<string, Record<string, string[]>> = {
  Amazonas: {
    Chachapoyas: ["Chachapoyas", "Huancas", "La Jalca", "Leimebamba", "Levanto", "Magdalena", "Mariscal Castilla", "Molinopampa", "Montevideo", "Olleros", "Quinjalca", "San Francisco de Daguas", "San Isidro de Maino", "Soloco", "Sonche"],
    Bagua: ["Bagua", "Aramango", "Copallin", "El Parco", "Imaza", "La Peca"],
    Bongará: ["Jumbilla", "Chisquilla", "Churuja", "Corosha", "Cuispes", "Florida", "Jazan", "Recta", "San Carlos", "Shipasbamba", "Valera", "Yambrasbamba"],
    Condorcanqui: ["Nieva", "El Cenepa", "Río Santiago"],
    Luya: ["Lamud", "Camporredondo", "Cocabamba", "Colcamar", "Conila", "Inguilpata", "Lonya Chico", "Luya", "Luya Viejo", "María", "Ocalli", "Ocumal", "Pisuquia", "Providencia", "San Cristóbal", "San Francisco del Yeso", "San Juan de Lopecancha", "Santa Catalina", "Santo Tomás", "Tingo", "Trita"],
    "Rodríguez de Mendoza": ["Mendoza", "Chirimoto", "Cochamal", "Huambo", "Limabamba", "Longar", "Mariscal Benavides", "Milpuc", "Omia", "Santa Rosa", "Totora", "Vista Alegre"],
    Utcubamba: ["Bagua Grande", "Cajaruro", "Cumba", "El Milagro", "Jamalca", "Lonya Grande", "Yamon"],
  },
  Áncash: {
    Huaraz: ["Huaraz", "Cochabamba", "Colcabamba", "Huanchay", "Independencia", "Jangas", "La Libertad", "Olleros", "Pampas Grande", "Pariacoto", "Pira", "Tarica"],
    Aija: ["Aija", "Coris", "Huacllan", "La Merced", "Succha"],
    "Antonio Raymondi": ["Llamellín", "Aczo", "Chaccho", "Chingas", "Mirgas", "San Juan de Rontoy"],
    Asunción: ["Chacas", "Acochaca"],
    Bolognesi: ["Chiquián", "Abelardo Pardo Lezameta", "Antonio Raymondi", "Aquia", "Cajacay", "Canis", "Colquioc", "Huallanca", "Huasta", "Huayllacayán", "La Primavera", "Mangas", "Pacllón", "San Miguel de Corpanqui", "Ticllos"],
    Carhuaz: ["Carhuaz", "Acopampa", "Amashca", "Anta", "Ataquero", "Marcará", "Pariahuanca", "San Miguel de Aco", "Shilla", "Tinco", "Yungar"],
    "Carlos Fermín Fitzcarrald": ["San Luis", "San Nicolás", "Yauya"],
    Casma: ["Casma", "Buena Vista Alta", "Comandante Noel", "Yaután"],
    Corongo: ["Corongo", "Aco", "Bambas", "Cusca", "La Pampa", "Yanac", "Yupan"],
    Huari: ["Huari", "Anra", "Cajay", "Chavín de Huántar", "Huacachi", "Huacchis", "Huachis", "Huantar", "Masin", "Paucas", "Ponto", "Rahuapampa", "Rapayan", "San Marcos", "San Pedro de Chana", "Uco"],
    Huarmey: ["Huarmey", "Cochapeti", "Culebras", "Huayan", "Malvas"],
    Huaylas: ["Caraz", "Huallanca", "Huata", "Huaylas", "Mato", "Pamparomas", "Pueblo Libre", "Santa Cruz", "Santo Toribio", "Yuracmarca"],
    "Mariscal Luzuriaga": ["Piscobamba", "Casca", "Eleazar Guzmán Barrón", "Fidel Olivas Escudero", "Llama", "Llumpa", "Lucma", "Musga"],
    Ocros: ["Ocros", "Acas", "Cajamarquilla", "Carhuapampa", "Cochas", "Congas", "Llipa", "San Cristóbal de Rajan", "San Pedro", "Santiago de Chilcas"],
    Pallasca: ["Cabana", "Bolognesi", "Conchucos", "Huacaschuque", "Huandoval", "Lacabamba", "Llapo", "Pallasca", "Pampas", "Santa Rosa", "Tauca"],
    Pomabamba: ["Pomabamba", "Huayllan", "Parobamba", "Quinuabamba"],
    Recuay: ["Recuay", "Catac", "Cotaparaco", "Huayllapampa", "Llacllin", "Marca", "Pampas Chico", "Pararin", "Tapacocha", "Ticapampa"],
    Santa: ["Chimbote", "Cáceres del Perú", "Coishco", "Macate", "Moro", "Nepeña", "Samanco", "Santa", "Nuevo Chimbote"],
    Sihuas: ["Sihuas", "Acobamba", "Alfonso Ugarte", "Cashapampa", "Chingalpo", "Huayllabamba", "Quiches", "Ragash", "San Juan", "Sicsibamba"],
    Yungay: ["Yungay", "Cascapara", "Mancos", "Matacoto", "Quillo", "Ranrahirca", "Shupluy", "Yanama"],
  },
  Apurímac: {
    Abancay: ["Abancay", "Chacoche", "Circa", "Curahuasi", "Huanipaca", "Lambrama", "Pichirhua", "San Pedro de Cachora", "Tamburco"],
    Andahuaylas: ["Andahuaylas", "Andarapa", "Chiara", "Huancarama", "Huancaray", "Huayana", "Kishuara", "Pacobamba", "Pacucha", "Pampachiri", "Pomacocha", "San Antonio de Cachi", "San Jerónimo", "San Miguel de Chaccrampa", "Santa María de Chicmo", "Talavera", "Tumay Huaraca", "Turpo", "Kaquiabamba", "José María Arguedas"],
    Antabamba: ["Antabamba", "El Oro", "Huaquirca", "Juan Espinoza Medrano", "Oropesa", "Pachaconas", "Sabaino"],
    Aymaraes: ["Chalhuanca", "Capaya", "Caraybamba", "Chapimarca", "Colcabamba", "Cotaruse", "Ihuayllo", "Justo Apu Sahuaraura", "Lucre", "Pocohuanca", "San Juan de Chacña", "Sañayca", "Soraya", "Tapairihua", "Tintay", "Toraya", "Yanaca"],
    Cotabambas: ["Tambobamba", "Cotabambas", "Coyllurqui", "Haquira", "Mara", "Challhuahuacho"],
    Chincheros: ["Chincheros", "Anco Huallo", "Cocharcas", "Huaccana", "Ocobamba", "Ongoy", "Uranmarca", "Ranracancha", "Rocchacc", "El Porvenir", "Los Chankas"],
    Grau: ["Chuquibambilla", "Curpahuasi", "Gamarra", "Huayllati", "Mamara", "Micaela Bastidas", "Pataypampa", "Progreso", "San Antonio", "Santa Rosa", "Turpay", "Vilcabamba", "Virundo", "Curasco"],
  },
  Arequipa: {
    Arequipa: ["Arequipa", "Alto Selva Alegre", "Cayma", "Cerro Colorado", "Characato", "Chiguata", "Jacobo Hunter", "La Joya", "Mariano Melgar", "Miraflores", "Mollebaya", "Paucarpata", "Pocsi", "Polobaya", "Quequeña", "Sabandía", "Sachaca", "San Juan de Siguas", "San Juan de Tarucani", "Santa Isabel de Siguas", "Santa Rita de Siguas", "Socabaya", "Tiabaya", "Uchumayo", "Vitor", "Yanahuara", "Yarabamba", "Yura", "José Luis Bustamante y Rivero"],
    Camaná: ["Camaná", "José María Quimper", "Mariano Nicolás Valcárcel", "Mariscal Cáceres", "Nicolás de Piérola", "Ocoña", "Quilca", "Samuel Pastor"],
    Caravelí: ["Caravelí", "Acarí", "Atico", "Atiquipa", "Bella Unión", "Cahuacho", "Chala", "Chaparra", "Huanuhuanu", "Jaqui", "Lomas", "Quicacha", "Yauca"],
    Castilla: ["Aplao", "Andagua", "Ayo", "Chachas", "Chilcaymarca", "Choco", "Huancarqui", "Machaguay", "Orcopampa", "Pampacolca", "Tipan", "Uñon", "Uraca", "Viraco"],
    Caylloma: ["Chivay", "Achoma", "Cabanaconde", "Callalli", "Caylloma", "Coporaque", "Huambo", "Huanca", "Ichupampa", "Lari", "Lluta", "Maca", "Madrigal", "San Antonio de Chuca", "Sibayo", "Tapay", "Tisco", "Tuti", "Yanque", "Majes"],
    Condesuyos: ["Chuquibamba", "Andaray", "Cayarani", "Chichas", "Iray", "Río Grande", "Salamanca", "Yanaquihua"],
    Islay: ["Mollendo", "Cocachacra", "Dean Valdivia", "Islay", "Mejía", "Punta de Bombón"],
    "La Unión": ["Cotahuasi", "Alca", "Charcana", "Huaynacotas", "Pampamarca", "Puyca", "Quechualla", "Sayla", "Tauria", "Tomepampa", "Toro"],
  },
  Ayacucho: {
    Huamanga: ["Ayacucho", "Acocro", "Acos Vinchos", "Carmen Alto", "Chiara", "Ocros", "Pacaycasa", "Quinua", "San José de Ticllas", "San Juan Bautista", "Santiago de Pischa", "Socos", "Tambillo", "Vinchos", "Jesús Nazareno", "Andrés Avelino Cáceres Dorregaray"],
    Cangallo: ["Cangallo", "Chuschi", "Los Morochucos", "María Parado de Bellido", "Paras", "Totos"],
    "Huanca Sancos": ["Sancos", "Carapo", "Sacsamarca", "Santiago de Lucanamarca"],
    Huanta: ["Huanta", "Ayahuanco", "Huamanguilla", "Iguain", "Luricocha", "Santillana", "Sivia", "Llochegua", "Canayre", "Uchuraccay", "Pucacolpa", "Chaca"],
    "La Mar": ["San Miguel", "Anco", "Ayna", "Chilcas", "Chungui", "Luis Carranza", "Santa Rosa", "Tambo", "Samugari", "Anchihuay", "Oronccoy"],
    Lucanas: ["Puquio", "Aucara", "Cabana", "Carmen Salcedo", "Chaviña", "Chipao", "Huac-Huas", "Laramate", "Leoncio Prado", "Llauta", "Lucanas", "Ocaña", "Otoca", "Saisa", "San Cristóbal", "San Juan", "San Pedro", "San Pedro de Palco", "Sancos", "Santa Ana de Huaycahuacho", "Santa Lucia"],
    Parinacochas: ["Coracora", "Chumpi", "Coronel Castañeda", "Pacapausa", "Pullo", "Puyusca", "San Francisco de Ravacayco", "Upahuacho"],
    "Páucar del Sara Sara": ["Pausa", "Colta", "Corculla", "Lampa", "Marcabamba", "Oyolo", "Pararca", "San Javier de Alpabamba", "San José de Ushua", "Sara Sara"],
    Sucre: ["Querobamba", "Belén", "Chalcos", "Chilcayoc", "Huacaña", "Morcolla", "Paico", "San Pedro de Larcay", "San Salvador de Quije", "Santiago de Paucaray", "Soras"],
    "Víctor Fajardo": ["Huancapi", "Alcamenca", "Apongo", "Asquipata", "Canaria", "Cayara", "Colca", "Huamanquiquia", "Huancaraylla", "Hualla", "Sarhua", "Vilcanchos"],
    "Vilcas Huamán": ["Vilcas Huamán", "Accomarca", "Carhuanca", "Concepción", "Huambalpa", "Independencia", "Saurama", "Vischongo"],
  },
  Cajamarca: {
    Cajamarca: ["Cajamarca", "Asunción", "Chetilla", "Cospan", "Encañada", "Jesús", "Llacanora", "Los Baños del Inca", "Magdalena", "Matara", "Namora", "San Juan"],
    Cajabamba: ["Cajabamba", "Cachachi", "Condebamba", "Sitacocha"],
    Celendín: ["Celendín", "Chumuch", "Cortegana", "Huasmin", "Jorge Chávez", "José Gálvez", "Miguel Iglesias", "Oxamarca", "Sorochuco", "Sucre", "Utco", "La Libertad de Pallán"],
    Chota: ["Chota", "Anguia", "Chadin", "Chiguirip", "Chimban", "Choropampa", "Cochabamba", "Conchan", "Huambos", "Lajas", "Llama", "Miracosta", "Paccha", "Pion", "Querocoto", "San Juan de Licupis", "Tacabamba", "Tocmoche", "Chalamarca"],
    Contumazá: ["Contumazá", "Chilete", "Cupisnique", "Guzmango", "San Benito", "Santa Cruz de Toledo", "Tantarica", "Yonán"],
    Cutervo: ["Cutervo", "Callayuc", "Choros", "Cujillo", "La Ramada", "Pimpingos", "Querocotillo", "San Andrés de Cutervo", "San Juan de Cutervo", "San Luis de Lucma", "Santa Cruz", "Santo Domingo de la Capilla", "Santo Tomás", "Socota", "Toribio Casanova"],
    Hualgayoc: ["Bambamarca", "Chugur", "Hualgayoc"],
    Jaén: ["Jaén", "Bellavista", "Chontali", "Colasay", "Huabal", "Las Pirias", "Pomahuaca", "Pucara", "Sallique", "San Felipe", "San José del Alto", "Santa Rosa"],
    "San Ignacio": ["San Ignacio", "Chirinos", "Huarango", "La Coipa", "Namballe", "San José de Lourdes", "Tabaconas"],
    "San Marcos": ["Pedro Gálvez", "Chancay", "Eduardo Villanueva", "Gregorio Pita", "Ichocan", "José Manuel Quiroz", "José Sabogal"],
    "San Miguel": ["San Miguel", "Bolívar", "Calquis", "Catilluc", "El Prado", "La Florida", "Llapa", "Nanchoc", "Niepos", "San Gregorio", "San Silvestre de Cochan", "Tongod", "Unión Agua Blanca"],
    "San Pablo": ["San Pablo", "San Bernardino", "San Luis", "Tumbaden"],
    "Santa Cruz": ["Santa Cruz", "Andabamba", "Catache", "Chancaybaños", "La Esperanza", "Ninabamba", "Pulan", "Saucepampa", "Sexi", "Uticyacu", "Yauyucan"],
  },
  Callao: {
    Callao: ["Callao", "Bellavista", "Carmen de la Legua Reynoso", "La Perla", "La Punta", "Ventanilla", "Mi Perú"],
  },
  Cusco: {
    Cusco: ["Cusco", "Ccorca", "Poroy", "San Jerónimo", "San Sebastián", "Santiago", "Saylla", "Wanchaq"],
    Acomayo: ["Acomayo", "Acopia", "Acos", "Mosoc Llacta", "Pomacanchi", "Rondocan", "Sangarara"],
    Anta: ["Anta", "Ancahuasi", "Cachimayo", "Chinchaypujio", "Huarocondo", "Limatambo", "Mollepata", "Pucyura", "Zurite"],
    Calca: ["Calca", "Coya", "Lamay", "Lares", "Pisac", "San Salvador", "Taray", "Yanatile"],
    Canas: ["Yanaoca", "Checca", "Kunturkanki", "Langui", "Layo", "Pampamarca", "Quehue", "Tupac Amaru"],
    Canchis: ["Sicuani", "Checacupe", "Combapata", "Marangani", "Pitumarca", "San Pablo", "San Pedro", "Tinta"],
    Chumbivilcas: ["Santo Tomás", "Capacmarca", "Chamaca", "Colquemarca", "Livitaca", "Llusco", "Quiñota", "Velille"],
    Espinar: ["Espinar", "Condoroma", "Coporaque", "Ocoruro", "Pallpata", "Pichigua", "Suyckutambo", "Alto Pichigua"],
    "La Convención": ["Santa Ana", "Echarate", "Huayopata", "Maranura", "Ocobamba", "Quellouno", "Kimbiri", "Santa Teresa", "Vilcabamba", "Pichari", "Inkawasi", "Villa Virgen", "Villa Kintiarina", "Megantoni"],
    Paruro: ["Paruro", "Accha", "Ccapi", "Colcha", "Huanoquite", "Omacha", "Paccaritambo", "Pillpinto", "Yaurisque"],
    Paucartambo: ["Paucartambo", "Caicay", "Challabamba", "Colquepata", "Huancarani", "Kosñipata"],
    Quispicanchi: ["Urcos", "Andahuaylillas", "Camanti", "Ccarhuayo", "Ccatca", "Cusipata", "Huaro", "Lucre", "Marcapata", "Ocongate", "Oropesa", "Quiquijana"],
    Urubamba: ["Urubamba", "Chinchero", "Huayllabamba", "Machupicchu", "Maras", "Ollantaytambo", "Yucay"],
  },
  Huancavelica: {
    Huancavelica: ["Huancavelica", "Acobambilla", "Acoria", "Conayca", "Cuenca", "Huachocolpa", "Huayllahuara", "Izcuchaca", "Laria", "Manta", "Mariscal Cáceres", "Moya", "Nuevo Occoro", "Palca", "Pilchaca", "Vilca", "Yauli", "Ascensión", "Huando"],
    Acobamba: ["Acobamba", "Andabamba", "Anta", "Caja", "Marcas", "Paucara", "Pomacocha", "Rosario"],
    Angaraes: ["Lircay", "Anchonga", "Callanmarca", "Ccochaccasa", "Chincho", "Congalla", "Huanca-Huanca", "Huayllay Grande", "Julcamarca", "San Antonio de Antaparco", "Santo Tomás de Pata", "Secclla"],
    Castrovirreyna: ["Castrovirreyna", "Arma", "Aurahua", "Capillas", "Chupamarca", "Cocas", "Huachos", "Huamatambo", "Mollepampa", "San Juan", "Santa Ana", "Tantara", "Ticrapo"],
    Churcampa: ["Churcampa", "Anco", "Chinchihuasi", "El Carmen", "La Merced", "Locroja", "Paucarbamba", "San Miguel de Mayocc", "San Pedro de Coris", "Pachamarca", "Cosme"],
    Huaytará: ["Huaytará", "Ayavi", "Córdova", "Huayacundo Arma", "Laramarca", "Ocoyo", "Pilpichaca", "Querco", "Quito-Arma", "San Antonio de Cusicancha", "San Francisco de Sangayaico", "San Isidro", "Santiago de Chocorvos", "Santiago de Quirahuara", "Santo Domingo de Capillas", "Tambo"],
    Tayacaja: ["Pampas", "Acostambo", "Acraquia", "Ahuaycha", "Colcabamba", "Daniel Hernández", "Huachocolpa", "Huaribamba", "Ñahuimpuquio", "Pazos", "Quishuar", "Salcabamba", "Salcahuasi", "San Marcos de Rocchac", "Surcubamba", "Tintay Puncu", "Quichuas", "Andaymarca", "Roble", "Pichos", "Santiago de Tucuma"],
  },
  Huánuco: {
    Huánuco: ["Huánuco", "Amarilis", "Chinchao", "Churubamba", "Margos", "Quisqui", "San Francisco de Cayrán", "San Pedro de Chaulán", "Santa María del Valle", "Yarumayo", "Pillco Marca", "Yacus", "San Pablo de Pillao"],
    Ambo: ["Ambo", "Cayna", "Colpas", "Conchamarca", "Huacar", "San Francisco", "San Rafael", "Tomay Kichwa"],
    "Dos de Mayo": ["La Unión", "Chuquis", "Marías", "Pachas", "Quivilla", "Ripan", "Shunqui", "Sillapata", "Yanas"],
    Huacaybamba: ["Huacaybamba", "Canchabamba", "Cochabamba", "Pinra"],
    Huamalíes: ["Llata", "Arancay", "Chavín de Pariarca", "Jacas Grande", "Jircan", "Miraflores", "Monzón", "Punchao", "Puños", "Singa", "Tantamayo"],
    "Leoncio Prado": ["Rupa-Rupa", "Daniel Alomía Robles", "Hermílio Valdizán", "José Crespo y Castillo", "Luyando", "Mariano Dámaso Beraún", "Pucayacu", "Castillo Grande", "Pueblo Nuevo", "Santo Domingo de Anda"],
    Marañón: ["Huacrachuco", "Cholon", "San Buenaventura", "La Morada", "Santa Rosa de Alto Yanajanca"],
    Pachitea: ["Panao", "Chaglla", "Molino", "Umari"],
    "Puerto Inca": ["Puerto Inca", "Codo del Pozuzo", "Honoria", "Tournavista", "Yuyapichis"],
    Lauricocha: ["Jesús", "Baños", "Jivia", "Queropalca", "Rondos", "San Francisco de Asís", "San Miguel de Cauri"],
    Yarowilca: ["Chavinillo", "Cahuac", "Chacabamba", "Aparicio Pomares", "Jacas Chico", "Obas", "Pampamarca", "Choras"],
  },
  Ica: {
    Ica: ["Ica", "La Tinguiña", "Los Aquijes", "Ocucaje", "Pachacutec", "Parcona", "Pueblo Nuevo", "Salas", "San José de Los Molinos", "San Juan Bautista", "Santiago", "Subtanjalla", "Tate", "Yauca del Rosario"],
    Chincha: ["Chincha Alta", "Alto Larán", "Chavín", "Chincha Baja", "El Carmen", "Grocio Prado", "Pueblo Nuevo", "San Juan de Yanac", "San Pedro de Huacarpana", "Sunampe", "Tambo de Mora"],
    Nasca: ["Nasca", "Changuillo", "El Ingenio", "Marcona", "Vista Alegre"],
    Palpa: ["Palpa", "Llipata", "Río Grande", "Santa Cruz", "Tibillo"],
    Pisco: ["Pisco", "Huancano", "Humay", "Independencia", "Paracas", "San Andrés", "San Clemente", "Túpac Amaru Inca"],
  },
  Junín: {
    Huancayo: ["Huancayo", "Carhuacallanga", "Chacapampa", "Chicche", "Chilca", "Chongos Alto", "Chupuro", "Colca", "Cullhuas", "El Tambo", "Huacrapuquio", "Hualhuas", "Huancan", "Huasicancha", "Huayucachi", "Ingenio", "Pariahuanca", "Pilcomayo", "Pucara", "Quichuay", "Quilcas", "San Agustín", "San Jerónimo de Tunán", "Saño", "Sapallanga", "Sicaya", "Santo Domingo de Acobamba", "Viques"],
    Concepción: ["Concepción", "Aco", "Andamarca", "Chambara", "Cochas", "Comas", "Heroínas Toledo", "Manzanares", "Mariscal Castilla", "Matahuasi", "Mito", "Nueve de Julio", "Orcotuna", "San José de Quero", "Santa Rosa de Ocopa"],
    Chanchamayo: ["Chanchamayo", "Perené", "Pichanaqui", "San Luis de Shuaro", "San Ramón", "Vitoc"],
    Jauja: ["Jauja", "Acolla", "Apata", "Ataura", "Canchayllo", "Curicaca", "El Mantaro", "Huamali", "Huaripampa", "Huertas", "Janjaillo", "Julcán", "Leonor Ordóñez", "Llocllapampa", "Marco", "Masma", "Masma Chicche", "Molinos", "Monobamba", "Muqui", "Muquiyauyo", "Paca", "Paccha", "Pancan", "Parco", "Pomacancha", "Ricran", "San Lorenzo", "San Pedro de Chunan", "Sausa", "Sincos", "Tunan Marca", "Yauli", "Yauyos"],
    Junín: ["Junín", "Carhuamayo", "Ondores", "Ulcumayo"],
    Satipo: ["Satipo", "Coviriali", "Llaylla", "Mazamari", "Pampa Hermosa", "Pangoa", "Río Negro", "Río Tambo", "Vizcatán del Ene"],
    Tarma: ["Tarma", "Acobamba", "Huaricolca", "Huasahuasi", "La Unión", "Palca", "Palcamayo", "San Pedro de Cajas", "Tapo"],
    Yauli: ["La Oroya", "Chacapalpa", "Huay-Huay", "Marcapomacocha", "Morococha", "Paccha", "Santa Bárbara de Carhuacayan", "Santa Rosa de Sacco", "Suitucancha", "Yauli"],
    Chupaca: ["Chupaca", "Ahuac", "Chongos Bajo", "Huachac", "Huamancaca Chico", "San Juan de Iscos", "San Juan de Jarpa", "Tres de Diciembre", "Yanacancha"],
  },
  "La Libertad": {
    Trujillo: ["Trujillo", "El Porvenir", "Florencia de Mora", "Huanchaco", "La Esperanza", "Laredo", "Moche", "Poroto", "Salaverry", "Simbal", "Victor Larco Herrera"],
    Ascope: ["Ascope", "Chicama", "Chocope", "Magdalena de Cao", "Paiján", "Rázuri", "Santiago de Cao", "Casa Grande"],
    Bolívar: ["Bolívar", "Bambamarca", "Condormarca", "Longotea", "Uchumarca", "Ucuncha"],
    Chepén: ["Chepén", "Pacanga", "Pueblo Nuevo"],
    Julcán: ["Julcán", "Calamarca", "Carabamba", "Huaso"],
    Otuzco: ["Otuzco", "Agallpampa", "Charat", "Huaranchal", "La Cuesta", "Mache", "Paranday", "Salpo", "Sinsicap", "Usquil"],
    Pacasmayo: ["San Pedro de Lloc", "Guadalupe", "Jequetepeque", "Pacasmayo", "San José"],
    Pataz: ["Tayabamba", "Buldibuyo", "Chillia", "Huancaspata", "Huaylillas", "Huayo", "Ongon", "Parcoy", "Pataz", "Pías", "Santiago de Challas", "Taurija", "Urpay"],
    "Sánchez Carrión": ["Huamachuco", "Chugay", "Cochorco", "Curgos", "Marcabal", "Sanagorán", "Sarín", "Sartimbamba"],
    "Santiago de Chuco": ["Santiago de Chuco", "Angasmarca", "Cachicadán", "Mollebamba", "Mollepata", "Quiruvilca", "Santa Cruz de Chuca", "Sitabamba"],
    "Gran Chimú": ["Cascas", "Lucma", "Marmot", "Sayapullo"],
    Virú: ["Virú", "Chao", "Guadalupito"],
  },
  Lambayeque: {
    Chiclayo: ["Chiclayo", "Chongoyape", "Eten", "Eten Puerto", "José Leonardo Ortiz", "La Victoria", "Lagunas", "Monsefú", "Nueva Arica", "Oyotún", "Picsi", "Pimentel", "Reque", "Santa Rosa", "Saña", "Cayaltí", "Patapo", "Pomalca", "Pucalá", "Tumán"],
    Ferreñafe: ["Ferreñafe", "Cañaris", "Incahuasi", "Manuel Antonio Mesones Muro", "Pítipo", "Pueblo Nuevo"],
    Lambayeque: ["Lambayeque", "Chochope", "Illimo", "Jayanca", "Mochumí", "Mórrope", "Motupe", "Olmos", "Pacora", "Salas", "San José", "Túcume"],
  },
  Lima: {
    Lima: ["Lima", "Ancón", "Ate", "Barranco", "Breña", "Carabayllo", "Chaclacayo", "Chorrillos", "Cieneguilla", "Comas", "El Agustino", "Independencia", "Jesús María", "La Molina", "La Victoria", "Lince", "Los Olivos", "Lurigancho", "Lurín", "Magdalena del Mar", "Pueblo Libre", "Miraflores", "Pachacámac", "Pucusana", "Puente Piedra", "Punta Hermosa", "Punta Negra", "Rímac", "San Bartolo", "San Borja", "San Isidro", "San Juan de Lurigancho", "San Juan de Miraflores", "San Luis", "San Martín de Porres", "San Miguel", "Santa Anita", "Santa María del Mar", "Santa Rosa", "Santiago de Surco", "Surquillo", "Villa El Salvador", "Villa María del Triunfo"],
    Barranca: ["Barranca", "Paramonga", "Pativilca", "Supe", "Supe Puerto"],
    Cajatambo: ["Cajatambo", "Copa", "Gorgor", "Huancapon", "Manas"],
    Canta: ["Canta", "Arahuay", "Huamantanga", "Huaros", "Lachaqui", "San Buenaventura", "Santa Rosa de Quives"],
    Cañete: ["San Vicente de Cañete", "Asia", "Calango", "Cerro Azul", "Chilca", "Coayllo", "Imperial", "Lunahuaná", "Mala", "Nuevo Imperial", "Pacarán", "Quilmaná", "San Antonio", "San Luis", "Santa Cruz de Flores", "Zúñiga"],
    Huaral: ["Huaral", "Atavillos Alto", "Atavillos Bajo", "Aucallama", "Chancay", "Ihuari", "Lampian", "Pacaraos", "San Miguel de Acos", "Santa Cruz de Andamarca", "Sumbilca", "Veintisiete de Noviembre"],
    Huarochirí: ["Matucana", "Antioquia", "Callahuanca", "Carampoma", "Chicla", "Cuenca", "Huachupampa", "Huanza", "Huarochirí", "Lahuaytambo", "Langa", "Laraos", "Mariatana", "Ricardo Palma", "San Andrés de Tupicocha", "San Antonio", "San Bartolomé", "San Damian", "San Juan de Iris", "San Juan de Tantaranche", "San Lorenzo de Quinti", "San Mateo", "San Mateo de Otao", "San Pedro de Casta", "San Pedro de Huancayre", "Sangallaya", "Santa Cruz de Cocachacra", "Santa Eulalia", "Santiago de Anchucaya", "Santiago de Tuna", "Santo Domingo de los Olleros", "Surco"],
    Huaura: ["Huacho", "Ambar", "Caleta de Carquín", "Checras", "Hualmay", "Huaura", "Leoncio Prado", "Paccho", "Santa Leonor", "Santa María", "Sayán", "Vegueta"],
    Oyón: ["Oyón", "Andajes", "Caujul", "Cochamarca", "Navan", "Pachangara"],
    Yauyos: ["Yauyos", "Alis", "Ayauca", "Ayaviri", "Azángaro", "Cacra", "Carania", "Catahuasi", "Chocos", "Cochas", "Colonia", "Hongos", "Huampara", "Huancaya", "Huangascar", "Huantan", "Huañec", "Laraos", "Lincha", "Madean", "Miraflores", "Omas", "Putinza", "Quinches", "Quinocay", "San Joaquín", "San Pedro de Pilas", "Tanta", "Tauripampa", "Tomas", "Tupe", "Viñac", "Vitis"],
  },
  Loreto: {
    Maynas: ["Iquitos", "Alto Nanay", "Fernando Lores", "Indiana", "Las Amazonas", "Mazan", "Napo", "Punchana", "Torres Causana", "Belén", "San Juan Bautista"],
    "Alto Amazonas": ["Yurimaguas", "Balsapuerto", "Jeberos", "Lagunas", "Santa Cruz", "Teniente César López Rojas"],
    Loreto: ["Nauta", "Parinari", "Tigre", "Trompeteros", "Urarinas"],
    "Mariscal Ramón Castilla": ["Ramón Castilla", "Pebas", "Yavari", "San Pablo"],
    Requena: ["Requena", "Alto Tapiche", "Capelo", "Emilio San Martín", "Maquia", "Puinahua", "Saquena", "Soplin", "Tapiche", "Jenaro Herrera", "Yaquerana"],
    Ucayali: ["Contamana", "Inahuaya", "Padre Márquez", "Pampa Hermosa", "Sarayacu", "Vargas Guerra"],
    "Datem del Marañón": ["Barranca", "Cahuapanas", "Manseriche", "Morona", "Pastaza", "Andoas"],
    Putumayo: ["Putumayo", "Rosa Panduro", "Teniente Manuel Clavero", "Yaguas"],
  },
  "Madre de Dios": {
    Tambopata: ["Tambopata", "Inambari", "Las Piedras", "Laberinto"],
    Manu: ["Manu", "Fitzcarrald", "Madre de Dios", "Huepetuhe"],
    Tahuamanu: ["Iñapari", "Iberia", "Tahuamanu"],
  },
  Moquegua: {
    "Mariscal Nieto": ["Moquegua", "Carumas", "Cuchumbaya", "Samegua", "San Cristóbal", "Torata"],
    "General Sánchez Cerro": ["Omate", "Chojata", "Coalaque", "Ichuña", "La Capilla", "Lloque", "Matalaque", "Puquina", "Quinistaquillas", "Ubinas", "Yunga"],
    Ilo: ["Ilo", "El Algarrobal", "Pacocha"],
  },
  Pasco: {
    Pasco: ["Chaupimarca", "Huachon", "Huariaca", "Huayllay", "Ninacaca", "Pallanchacra", "Paucartambo", "San Francisco de Asís de Yarusyacan", "Simón Bolívar", "Ticlacayan", "Tinyahuarco", "Vicco", "Yanacancha"],
    "Daniel Alcides Carrión": ["Yanahuanca", "Chacayan", "Goyllarisquizga", "Paucar", "San Pedro de Pillao", "Santa Ana de Tusi", "Tapuc", "Vilcabamba"],
    Oxapampa: ["Oxapampa", "Chontabamba", "Huancabamba", "Palcazu", "Pozuzo", "Puerto Bermúdez", "Villa Rica", "Constitución"],
  },
  Piura: {
    Piura: ["Piura", "Castilla", "Catacaos", "Cura Mori", "El Tallán", "La Arena", "La Unión", "Las Lomas", "Tambo Grande", "Veintiséis de Octubre"],
    Ayabaca: ["Ayabaca", "Frias", "Jilili", "Lagunas", "Montero", "Pacaipampa", "Paimas", "Sapillica", "Sicchez", "Suyo"],
    Huancabamba: ["Huancabamba", "Canchaque", "El Carmen de la Frontera", "Huarmaca", "Lalaquiz", "San Miguel de El Faique", "Sondor", "Sondorillo"],
    Morropón: ["Chulucanas", "Buenos Aires", "Chalaco", "La Matanza", "Morropón", "Salitral", "San Juan de Bigote", "Santa Catalina de Mossa", "Santo Domingo", "Yamango"],
    Paita: ["Paita", "Amotape", "Arenal", "Colan", "La Huaca", "Tamarindo", "Vichayal"],
    Sullana: ["Sullana", "Bellavista", "Ignacio Escudero", "Lancones", "Marcavelica", "Miguel Checa", "Querecotillo", "Salitral"],
    Talara: ["Pariñas", "El Alto", "La Brea", "Lobitos", "Los Organos", "Mancora"],
    Sechura: ["Sechura", "Bellavista de la Unión", "Bernal", "Cristo Nos Valga", "Vice", "Rinconada Llicuar"],
  },
  Puno: {
    Puno: ["Puno", "Acora", "Amantani", "Atuncolla", "Capachica", "Chucuito", "Coata", "Huata", "Mañazo", "Paucarcolla", "Pichacani", "Plateria", "San Antonio", "Tiquillaca", "Vilque"],
    Azángaro: ["Azángaro", "Achaya", "Arapa", "Asillo", "Caminaca", "Chupa", "José Domingo Choquehuanca", "Muñani", "Potoni", "Saman", "San Anton", "San José", "San Juan de Salinas", "Santiago de Pupuja", "Tirapata"],
    Carabaya: ["Macusani", "Ajoyani", "Ayapata", "Coasa", "Corani", "Crucero", "Ituata", "Ollachea", "San Gaban", "Usicayos"],
    Chucuito: ["Juli", "Desaguadero", "Huacullani", "Kelluyo", "Pisacoma", "Pomata", "Zepita"],
    "El Collao": ["Ilave", "Capazo", "Pilcuyo", "Santa Rosa", "Conduriri"],
    Huancané: ["Huancané", "Cojata", "Huatasani", "Inchupalla", "Pusi", "Rosaspata", "Taraco", "Vilque Chico"],
    Lampa: ["Lampa", "Cabanilla", "Calapuja", "Nicasio", "Ocuviri", "Paratia", "Pucara", "Santa Lucia", "Vilavila"],
    Melgar: ["Ayaviri", "Antauta", "Cupi", "Llalli", "Macari", "Nuñoa", "Orurillo", "Santa Rosa", "Umachiri"],
    Moho: ["Moho", "Conima", "Huayrapata", "Tilali"],
    "San Antonio de Putina": ["Putina", "Ananea", "Pedro Vilca Apaza", "Quilcapuncu", "Sina"],
    "San Román": ["Juliaca", "Cabana", "Cabanillas", "Caracoto", "San Miguel"],
    Sandia: ["Sandia", "Cuyocuyo", "Limbani", "Patambuco", "Phara", "Quiaca", "San Juan del Oro", "Yanahuaya", "Alto Inambari", "San Pedro de Putina Punco"],
    Yunguyo: ["Yunguyo", "Anapia", "Copani", "Cuturapi", "Ollaraya", "Tinicachi", "Unicachi"],
  },
  "San Martín": {
    Moyobamba: ["Moyobamba", "Calzada", "Habana", "Jepelacio", "Soritor", "Yantalo"],
    Bellavista: ["Bellavista", "Alto Biavo", "Bajo Biavo", "Huallaga", "San Pablo", "San Rafael"],
    "El Dorado": ["San José de Sisa", "Agua Blanca", "San Martín", "Santa Rosa", "Shatoja"],
    Huallaga: ["Saposoa", "Alto Saposoa", "El Eslabón", "Piscoyacu", "Sacanche", "Tingo de Saposoa"],
    Lamas: ["Lamas", "Alonso de Alvarado", "Barranquita", "Caynarachi", "Cuñumbuqui", "Pinto Recodo", "Rumisapa", "San Roque de Cumbaza", "Shanao", "Tabalosos", "Zapatero"],
    "Mariscal Cáceres": ["Juanjuí", "Campanilla", "Huicungo", "Pachiza", "Pajarillo"],
    Picota: ["Picota", "Buenos Aires", "Caspisapa", "Pilluana", "Pucacaca", "San Cristóbal", "San Hilarión", "Shamboyacu", "Tingo de Ponasa", "Tres Unidos"],
    Rioja: ["Rioja", "Awajun", "Elías Soplin Vargas", "Nueva Cajamarca", "Pardo Miguel", "Posic", "San Fernando", "Yorongos", "Yuracyacu"],
    "San Martín": ["Tarapoto", "Alberto Leveau", "Cacatachi", "Chazuta", "Chipurana", "El Porvenir", "Huimbayoc", "Juan Guerra", "La Banda de Shilcayo", "Morales", "Papaplaya", "San Antonio", "Sauce", "Shapaja"],
    Tocache: ["Tocache", "Nuevo Progreso", "Polvora", "Shunte", "Uchiza"],
  },
  Tacna: {
    Tacna: ["Tacna", "Alto de la Alianza", "Calana", "Ciudad Nueva", "Inclán", "Pachia", "Palca", "Pocollay", "Sama", "Coronel Gregorio Albarracín Lanchipa", "La Yarada Los Palos"],
    Candarave: ["Candarave", "Cairani", "Camilaca", "Curibaya", "Huanuara", "Quilahuani"],
    "Jorge Basadre": ["Locumba", "Ilabaya", "Ite"],
    Tarata: ["Tarata", "Héroes Albarracín", "Estique", "Estique-Pampa", "Sitajara", "Susapaya", "Tarucachi", "Ticaco"],
  },
  Tumbes: {
    Tumbes: ["Tumbes", "Corrales", "La Cruz", "Pampas de Hospital", "San Jacinto", "San Juan de la Virgen"],
    "Contralmirante Villar": ["Zorritos", "Casitas", "Canoas de Punta Sal"],
    Zarumilla: ["Zarumilla", "Aguas Verdes", "Matapalo", "Papayal"],
  },
  Ucayali: {
    "Coronel Portillo": ["Callería", "Campoverde", "Iparia", "Masisea", "Yarinacocha", "Nueva Requena", "Manantay"],
    Atalaya: ["Raymondi", "Sepahua", "Tahuania", "Yurua"],
    "Padre Abad": ["Padre Abad", "Irazola", "Curimana", "Neshuya", "Alexander Von Humboldt"],
    Purús: ["Purús"],
  },
};

export function departmentsOf(countryCode: string): string[] {
  if (countryCode === "PE") return Object.keys(PERU);
  return [];
}

export function provincesOf(countryCode: string, department: string): string[] {
  if (countryCode !== "PE" || !department) return [];
  return Object.keys(PERU[department] ?? {});
}

export function districtsOf(countryCode: string, department: string, province: string): string[] {
  if (countryCode !== "PE" || !department || !province) return [];
  return PERU[department]?.[province] ?? [];
}

export function ubigeoCode(department: string, province: string, district: string): string {
  const deps = Object.keys(PERU);
  const di = deps.indexOf(department);
  if (di < 0) return "";
  const provs = Object.keys(PERU[department] ?? {});
  const pi = provs.indexOf(province);
  const dist = PERU[department]?.[province] ?? [];
  const dsi = dist.indexOf(district);
  if (pi < 0 || dsi < 0) return "";
  return `${String(di + 1).padStart(2, "0")}${String(pi + 1).padStart(2, "0")}${String(dsi + 1).padStart(2, "0")}`;
}

export function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}
