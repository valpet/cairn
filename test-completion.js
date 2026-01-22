import pkg from './packages/core/dist/index.js';
const { createContainer, TYPES, calculateCompletionPercentage } = pkg;

async function testCompletion() {
  try {
    const container = createContainer('./.cairn', '.');
    const storage = container.get(TYPES.IStorageService);
    const issues = await storage.loadIssues();

    console.log('Loaded', issues.length, 'issues');
    issues.slice(0, 5).forEach(issue => {
      console.log(`Issue ${issue.id}: ${issue.title}`);
      console.log(`  Completion: ${issue.completion_percentage}%`);
      console.log(`  AC: ${issue.acceptance_criteria?.length || 0} total, ${issue.acceptance_criteria?.filter(ac => ac.completed).length || 0} completed`);
      const subtasks = issues.filter(i => i.dependencies?.some(d => d.id === issue.id && d.type === 'parent-child'));
      console.log(`  Subtasks: ${subtasks.length} total, ${subtasks.filter(st => st.status === 'closed').length} completed`);

      // Manual calculation
      const manualCalc = calculateCompletionPercentage(issue, issues);
      console.log(`  Manual calc: ${manualCalc}`);
      console.log('');
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

testCompletion();