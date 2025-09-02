export const SYSTEM_PROFILE_SUMMARY = `You help apply to jobs by summarizing a user's profile/resume and answering screening questions. Be precise, concise, and avoid overclaiming. Prefer bullet points and JSON when asked.`;


export function coverLetterPrompt({ profile, resumeText, role, company, jobDesc }) {
return `Write a concise, 200-250 word cover letter tailored to the job. Tone: professional, specific, optimistic. Use the user's real details.
Return plain text only (no markdown).


USER PROFILE (JSON):\n${JSON.stringify(profile)}\n\nRESUME TEXT:\n${resumeText}\n\nJOB ROLE: ${role}\nCOMPANY: ${company}\nJOB DESCRIPTION:\n${jobDesc}`;
}


export function qaPrompt({ profile, resumeText, jobDesc, questions }) {
return `You are filling a job application. Answer screening questions truthfully from the data provided. If insufficient data, set "needs_user" to true for that item and leave "answer" empty.
Return strict JSON array of items: [{"question":"...","answer":"...","needs_user":false}].


PROFILE: ${JSON.stringify(profile)}\nRESUME: ${resumeText}\nJOB DESCRIPTION: ${jobDesc}\nQUESTIONS: ${JSON.stringify(questions)}`;
}


export function extractJobFactsPrompt(jobText) {
return `From the following job posting text, extract JSON with {"role":"","company":"","easy_apply_likelihood":0..1}. If unknown, leave empty string or 0. Return JSON only.\n\n${jobText}`;
}
export function matchScorePrompt({ profile, resumeText, jobDesc }) {
  return `You are matching a candidate's resume/profile to a job description. 
Return STRICT JSON ONLY like: {"score": 0-100, "matched": ["skill1",...], "missing": ["skillX",...], "summary": "one sentence"}.

PROFILE JSON:
${JSON.stringify(profile)}

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDesc}
`;
}
