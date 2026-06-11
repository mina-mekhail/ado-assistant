export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let messages;
  try {
    messages = req.body?.messages;
  } catch(e) {
    return res.status(400).json({ error: 'Could not parse request body' });
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required and must not be empty' });
  }

  const SYSTEM_PROMPT = `You are an expert Azure DevOps (ADO) assistant grounded in the official Microsoft documentation at https://learn.microsoft.com/en-us/azure/devops/.

Key reference URLs:
- Area paths: https://learn.microsoft.com/en-us/azure/devops/organizations/settings/set-area-paths?view=azure-devops
- Iteration paths: https://learn.microsoft.com/en-us/azure/devops/organizations/settings/set-iteration-paths-sprints?view=azure-devops
- Inheritance process model: https://learn.microsoft.com/en-us/azure/devops/organizations/settings/work/inheritance-process-model?view=azure-devops
- Add custom field: https://learn.microsoft.com/en-us/azure/devops/organizations/settings/work/add-custom-field?view=azure-devops
- Add custom work item type: https://learn.microsoft.com/en-us/azure/devops/organizations/settings/work/add-custom-wit?view=azure-devops
- Configure boards: https://learn.microsoft.com/en-us/azure/devops/boards/configure-customize?view=azure-devops
- Workflow states: https://learn.microsoft.com/en-us/azure/devops/boards/work-items/workflow-and-state-categories?view=azure-devops
- Process templates: https://learn.microsoft.com/en-us/azure/devops/boards/work-items/guidance/choose-process?view=azure-devops

When answering:
- Be concise and practical
- Use bullet points for lists, numbered steps for procedures
- Always mention where in the ADO UI to find things (e.g. "Project Settings > Boards > Teams")
- Include relevant documentation URLs
- Cover all ADO areas: Boards, Pipelines, Repos, Test Plans, Artifacts, permissions, process customization, SAFe/Agile alignment, and Jira-to-ADO migrations`;

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'web-search-2025-03-05'
  };

  try {
    let currentMessages = messages.map(m => ({ role: m.role, content: m.content }));

    let response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: currentMessages
      })
    });

    let data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: data.error?.message || `Anthropic API error: ${response.status}` 
      });
    }

    // Agentic loop: handle tool_use rounds
    let rounds = 0;
    while (data.stop_reason === 'tool_use' && rounds < 5) {
      rounds++;

      const toolUseBlocks = data.content.filter(b => b.type === 'tool_use');
      const toolResults = toolUseBlocks.map(b => ({
        type: 'tool_result',
        tool_use_id: b.id,
        content: b.output ?? ''
      }));

      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: data.content },
        { role: 'user', content: toolResults }
      ];

      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          system: SYSTEM_PROMPT,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: currentMessages
        })
      });

      data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({ 
          error: data.error?.message || `Anthropic API error on round ${rounds}: ${response.status}` 
        });
      }
    }

    const reply = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    return res.status(200).json({ 
      reply: reply || 'No response generated. Please try again.',
      didSearch: rounds > 0
    });

  } catch (error) {
    return res.status(500).json({ error: 'Server error: ' + error.message });
  }
}
