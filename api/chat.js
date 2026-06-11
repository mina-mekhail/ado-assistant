export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const MS_DOCS_CONTEXT = `
MICROSOFT DOCS REFERENCE STRUCTURE (fetched from https://learn.microsoft.com/en-us/azure/devops/reference/?view=azure-devops):

The official Azure Boards Configuration & Customization documentation covers:

CONFIGURE TEAMS:
- About teams & Agile tools: https://learn.microsoft.com/en-us/azure/devops/organizations/settings/about-teams-and-settings?view=azure-devops
- Configure team tools: https://learn.microsoft.com/en-us/azure/devops/organizations/settings/manage-teams?view=azure-devops
- Set team area paths: https://learn.microsoft.com/en-us/azure/devops/organizations/settings/set-area-paths?view=azure-devops
- Set team iterations: https://learn.microsoft.com/en-us/azure/devops/organizations/settings/set-iteration-paths-sprints?view=azure-devops

CONFIGURE PROJECTS:
- Configure & customize Boards: https://learn.microsoft.com/en-us/azure/devops/boards/configure-customize?view=azure-devops
- About projects & scaling up: https://learn.microsoft.com/en-us/azure/devops/organizations/projects/about-projects?view=azure-devops
- Define area paths: https://learn.microsoft.com/en-us/azure/devops/organizations/settings/set-area-paths?view=azure-devops
- Define iteration paths (sprints): https://learn.microsoft.com/en-us/azure/devops/organizations/settings/set-iteration-paths-sprints?view=azure-devops

INHERITANCE PROCESS CUSTOMIZATION:
- Inheritance process model: https://learn.microsoft.com/en-us/azure/devops/organizations/settings/work/inheritance-process-model?view=azure-devops
- Add a custom field: https://learn.microsoft.com/en-us/azure/devops/organizations/settings/work/add-custom-field?view=azure-devops
- Add a custom work item type: https://learn.microsoft.com/en-us/azure/devops/organizations/settings/work/add-custom-wit?view=azure-devops
- Customize a workflow: https://learn.microsoft.com/en-us/azure/devops/organizations/settings/work/customize-process-workflow?view=azure-devops
- Apply rules to workflow: https://learn.microsoft.com/en-us/azure/devops/organizations/settings/work/apply-rules-to-workflow-states?view=azure-devops
- Customize a project: https://learn.microsoft.com/en-us/azure/devops/organizations/settings/work/customize-process?view=azure-devops
- Create & manage a process: https://learn.microsoft.com/en-us/azure/devops/organizations/settings/work/manage-process?view=azure-devops

REFERENCE:
- Naming restrictions: https://learn.microsoft.com/en-us/azure/devops/organizations/settings/naming-restrictions?view=azure-devops
- Workflow states & categories: https://learn.microsoft.com/en-us/azure/devops/boards/work-items/workflow-and-state-categories?view=azure-devops
- Work tracking object limits: https://learn.microsoft.com/en-us/azure/devops/organizations/settings/work/object-limits?view=azure-devops
`;

  const SYSTEM_PROMPT = `You are an expert Azure DevOps (ADO) assistant. You have deep knowledge of ADO and are grounded in the official Microsoft documentation.

${MS_DOCS_CONTEXT}

Your primary reference is the official Microsoft ADO documentation at https://learn.microsoft.com/en-us/azure/devops/. When answering:
1. Use the web_search tool to find the latest information from Microsoft Docs when the question involves specific configuration steps, recent features, or anything that may have changed.
2. Always prefer information from learn.microsoft.com over general knowledge.
3. When you reference documentation, include the relevant URL so users can read further.
4. Be concise and practical. Use bullet points and numbered steps for procedural answers.
5. Mention where in the ADO UI to find things (e.g. "Project Settings > Boards > Team Configuration").
6. Cover all ADO areas: Boards, Pipelines, Repos, Test Plans, Artifacts, permissions, process customization, SAFe/Agile alignment, and migrations.

When uncertain about recent changes, say so and point to the relevant docs URL for verification.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Anthropic API error' });
    }

    const textBlocks = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    const didSearch = data.content.some(b => b.type === 'tool_use' && b.name === 'web_search');

    return res.status(200).json({ reply: textBlocks, didSearch });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
