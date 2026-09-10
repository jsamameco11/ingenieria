export type CompletenessView = {
  identity: number;
  profession: number;
  experience: number;
  education: number;
  skills: number;
  technologies: number;
  specialization: number;
  interests: number;
  goals: number;
  preferences: number;
  overall: number;
  missing: string[];
  next_questions: { question_id: string; text: string }[];
};

export function localCompleteness(input: {
  hasName: boolean;
  hasCountry: boolean;
  hasProfession: boolean;
  hasYears: boolean;
  hasRole: boolean;
  hasUniversity: boolean;
  skillCount: number;
  techCount: number;
  hasSpecialization: boolean;
  interestCount: number;
  goalCount: number;
  preferenceCount: number;
}): CompletenessView {
  const identity = Math.min(100, (input.hasName ? 50 : 0) + (input.hasCountry ? 50 : 0));
  const profession = input.hasProfession ? 100 : 0;
  const experience = Math.min(100, (input.hasYears ? 60 : 0) + (input.hasRole ? 40 : 0));
  const education = input.hasUniversity ? 80 : 0;
  const skills = Math.min(100, input.skillCount * 35);
  const technologies = Math.min(100, input.techCount * 35);
  const specialization = input.hasSpecialization ? 100 : input.interestCount ? 70 : 0;
  const interests = Math.min(100, input.interestCount * 25);
  const goals = input.goalCount ? 100 : 0;
  const preferences = Math.min(100, input.preferenceCount * 40);
  const overall = Math.round((identity + profession + experience + education + skills + technologies + specialization + interests + goals + preferences) / 10);
  const missing: string[] = [];
  const next_questions: CompletenessView["next_questions"] = [];
  if (profession < 100) {
    missing.push("profession");
    next_questions.push({ question_id: "q.profession", text: "¿Cuál es tu profesión?" });
  }
  if (!input.hasYears) {
    missing.push("experience");
    next_questions.push({ question_id: "q.experience_years", text: "¿Cuántos años de experiencia tienes?" });
  }
  if (education < 60) {
    missing.push("education");
    next_questions.push({ question_id: "q.university", text: "¿En qué universidad estudiaste?" });
  }
  if (interests < 40) {
    missing.push("interests");
    next_questions.push({ question_id: "q.specialty_focus", text: "¿En qué especialidades trabajas?" });
  }
  if (technologies < 35) {
    missing.push("technologies");
    next_questions.push({ question_id: "q.software_observed", text: "¿Qué software utilizas en tu trabajo?" });
  }
  return {
    identity,
    profession,
    experience,
    education,
    skills,
    technologies,
    specialization,
    interests,
    goals,
    preferences,
    overall,
    missing,
    next_questions,
  };
}
