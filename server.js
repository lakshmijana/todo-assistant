
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for todos (in production, use a database)
let todos = [
  { id: 1, text: 'Complete project documentation', completed: false, createdAt: new Date() },
  { id: 2, text: 'Review code changes', completed: false, createdAt: new Date() },
  { id: 3, text: 'Prepare for team meeting', completed: true, createdAt: new Date() }
];
let nextId = 4;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// GET /todos - Fetch all todos
app.get('/todos', (req, res) => {
  try {
    res.json({
      success: true,
      data: todos
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch todos'
    });
  }
});

// POST /todos - Add a new todo
app.post('/todos', (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || text.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Todo text is required'
      });
    }

    const newTodo = {
      id: nextId++,
      text: text.trim(),
      completed: false,
      createdAt: new Date()
    };

    todos.push(newTodo);

    res.status(201).json({
      success: true,
      data: newTodo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create todo'
    });
  }
});

// PUT /todos/:id - Update a todo
app.put('/todos/:id', (req, res) => {
  try {
    const todoId = parseInt(req.params.id);
    const { text, completed } = req.body;
    
    const todoIndex = todos.findIndex(todo => todo.id === todoId);
    
    if (todoIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Todo not found'
      });
    }

    if (text !== undefined) {
      todos[todoIndex].text = text.trim();
    }
    
    if (completed !== undefined) {
      todos[todoIndex].completed = completed;
    }

    res.json({
      success: true,
      data: todos[todoIndex]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update todo'
    });
  }
});

// DELETE /todos/:id - Delete a todo
app.delete('/todos/:id', (req, res) => {
  try {
    const todoId = parseInt(req.params.id);
    const todoIndex = todos.findIndex(todo => todo.id === todoId);
    
    if (todoIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Todo not found'
      });
    }

    const deletedTodo = todos.splice(todoIndex, 1)[0];

    res.json({
      success: true,
      data: deletedTodo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete todo'
    });
  }
});

// POST /summarize - Summarize todos and send to Slack
app.post('/summarize', async (req, res) => {
  try {
    // Get pending todos
    const pendingTodos = todos.filter(todo => !todo.completed);
    
    if (pendingTodos.length === 0) {
      return res.json({
        success: true,
        message: 'No pending todos to summarize',
        summary: 'All tasks are completed! 🎉'
      });
    }

    // Generate summary with fallback handling
    let summary;
    try {
      summary = await generateSummary(pendingTodos);
    } catch (error) {
      console.error('AI summary failed, using fallback:', error.message);
      summary = generateFallbackSummary(pendingTodos);
    }
    
    // Send to Slack
    if (process.env.SLACK_WEBHOOK_URL) {
      try {
        await sendToSlack(summary);
      } catch (slackError) {
        console.error('Slack notification failed:', slackError.message);
        // Continue execution even if Slack fails
      }
    }

    res.json({
      success: true,
      message: 'Summary generated successfully',
      summary: summary
    });

  } catch (error) {
    console.error('Error in summarize endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate summary'
    });
  }
});

// Function to generate summary using OpenAI
async function generateSummary(todos) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const todoList = todos.map(todo => `- ${todo.text}`).join('\n');
  
  const prompt = `Please provide a concise and professional summary of the following pending to-do items. 
Focus on identifying themes, priority areas, and providing an overview that would be useful for a team update:

${todoList}

Please format the response in a way that's suitable for sharing in a Slack channel.`;

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that summarizes to-do lists in a professional and concise manner.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    // Enhanced error handling for specific OpenAI errors
    if (error.response?.data?.error?.code === 'insufficient_quota') {
      throw new Error('OpenAI quota exceeded. Please check your billing settings at https://platform.openai.com/account/billing');
    } else if (error.response?.data?.error?.code === 'invalid_api_key') {
      throw new Error('Invalid OpenAI API key');
    } else if (error.response?.status === 429) {
      throw new Error('OpenAI rate limit exceeded. Please try again later');
    }
    
    console.error('OpenAI API error:', error.response?.data || error.message);
    throw new Error('Failed to generate AI summary');
  }
}

// Fallback summary generator when OpenAI is unavailable
function generateFallbackSummary(todos) {
  const totalTasks = todos.length;
  const taskList = todos.map(todo => `• ${todo.text}`).join('\n');
  
  // Simple categorization based on keywords
  const categories = {
    'Documentation': ['document', 'doc', 'write', 'report'],
    'Code Review': ['review', 'code', 'pull request', 'merge'],
    'Meetings': ['meeting', 'call', 'discuss', 'presentation'],
    'Development': ['develop', 'build', 'implement', 'create', 'fix'],
    'Testing': ['test', 'qa', 'bug', 'debug']
  };
  
  const categorizedTasks = {};
  todos.forEach(todo => {
    const text = todo.text.toLowerCase();
    let categorized = false;
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        if (!categorizedTasks[category]) categorizedTasks[category] = [];
        categorizedTasks[category].push(todo.text);
        categorized = true;
        break;
      }
    }
    
    if (!categorized) {
      if (!categorizedTasks['Other']) categorizedTasks['Other'] = [];
      categorizedTasks['Other'].push(todo.text);
    }
  });
  
  let summary = `📋 **Pending Tasks Summary** (${totalTasks} items)\n\n`;
  
  for (const [category, tasks] of Object.entries(categorizedTasks)) {
    summary += `**${category}** (${tasks.length} task${tasks.length > 1 ? 's' : ''}):\n`;
    tasks.forEach(task => summary += `• ${task}\n`);
    summary += '\n';
  }
  
  summary += `_Generated automatically on ${new Date().toLocaleString()}_`;
  
  return summary;
}

// Function to send message to Slack
async function sendToSlack(summary) {
  if (!process.env.SLACK_WEBHOOK_URL) {
    console.warn('Slack webhook URL not configured, skipping Slack notification');
    return;
  }

  const slackMessage = {
    text: "📋 Todo Summary Report",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📋 Todo Summary Report"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: summary
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Generated on ${new Date().toLocaleString()}`
          }
        ]
      }
    ]
  };

  try {
    await axios.post(process.env.SLACK_WEBHOOK_URL, slackMessage);
    console.log('Successfully sent summary to Slack');
  } catch (error) {
    console.error('Failed to send to Slack:', error.response?.data || error.message);
    throw new Error('Failed to send summary to Slack');
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  
  // Check configuration on startup
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  OpenAI API key not configured - AI summaries will use fallback mode');
  }
  if (!process.env.SLACK_WEBHOOK_URL) {
    console.warn('⚠️  Slack webhook URL not configured - Slack notifications disabled');
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});