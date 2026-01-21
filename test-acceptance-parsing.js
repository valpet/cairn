// Test script to verify acceptance criteria parsing
const testComments = [
  { content: "Acceptance Criteria: Criteria 1" },
  { content: "Acceptance Criteria: Criteria 2\nCriteria 3" },
  { content: "Some other comment" },
  { content: "Acceptance Criteria:Criteria 4,Criteria 5" }
];

const acceptanceCriteria = [];
for (const comment of testComments) {
  if (comment.content.startsWith('Acceptance Criteria:')) {
    const criteriaText = comment.content.replace('Acceptance Criteria:', '').trim();
    if (criteriaText) {
      const criteria = criteriaText.split(/\n|,/).map(c => c.trim()).filter(c => c);
      acceptanceCriteria.push(...criteria);
    }
  }
}

console.log('Parsed acceptance criteria:', acceptanceCriteria);