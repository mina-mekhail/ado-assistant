export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const MS_DOCS_CONTEXT = `
MICROSOFT DOCS REFERENCE STRUCTURE (from https://learn.microsoft.com/en-us/azure/devops/reference/?view=azure-devops):

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
- Customize a project: https://learn.microsoft.com/en-us/azure/devops/organizations/settings/work/customize-process?view=azure-devops
- Create & manage a process: https://learn.microsoft.com/en-us/azure/devops/organizations/settings/work/manage-process?view=azure-devops

REFERENCE:
- Naming restrictions: https://learn.microsoft.com/en-us/azure/devops/organizations/settings/naming-restrictions?view=azure-devops
- Workflow states & categories: https://learn.microsoft.com/en-us/azure/devops/boards/work-items/workflow-and-state-categories?view=azure-devops
- Work tracking object limits: https://learn.microsoft.com/en-us/azure/devops/organizations/settings/work/object-limits?view=azure-devops
`;

  const SYSTEM_PROMPT = `You are an expert Azure DevOps (ADO) assistant grounded in the official Microsoft documentation.

${MS_DOCS_CONTEXT}

When answering:
1. Use the web_search tool to find the latest information from Microsoft Docs when relevant.
2. Always prefer information from learn.microsoft.com over general knowledge.
3. Include relevant documentation URLs in your answers.
4. Be concise and practical. Use bullet points and numbered steps for procedures.
5. Mention where in the ADO UI to find things (e.g. "Project Settings > Boards > Team Configuration").
6. Cover all ADO areas: Boards, Pipelines, Repos, Test Plans, Artifacts, permissions, process customization, SAFe/Agile alignment, and migrations.`;

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'web-search-2025-03-05'
  };

  const tools = [{ type: 'web_search_20250305', name: 'web_search' }];

  try {
    // First API call
    let currentMessages = [...messages];
    let response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        tools,
        messages: currentMessages
      })
    });

    let data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Anthropic API error' });
    }

    // Agentic loop — handle tool use rounds (max 3 to avoid runaway)
    let rounds = 0;
    while (data.stop_reason === 'tool_use' && rounds < 3) {
      rounds++;

      // Build tool results from all tool_use blocks
      const toolResults = data.content
        .filter(b => b.type === 'tool_use')
        .map(b => ({
          type: 'tool_result',
          tool_use_id: b.id,
          content: b.type === 'tool_use' ? (b.output || '') : ''
        }));

      // Append assistant turn + tool results to messages
      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: data.content },
        { role: 'user', content: toolResults }
      ];

      // Follow-up call with tool results
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          system: SYSTEM_PROMPT,
          tools,
          messages: currentMessages
        })
      });

      data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({ error: data.error?.message || 'Anthropic API error' });
      }
    }

    // Extract final text response
    const textBlocks = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    const didSearch = rounds > 0;

    return res.status(200).json({ reply: textBlocks || 'No response generated. Please try again.', didSearch });

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
}
