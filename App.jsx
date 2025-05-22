import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE_URL = 'http://localhost:5000';

function App() {
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [summarizing, setSummarizing] = useState(false);

  // Fetch todos on component mount
  useEffect(() => {
    fetchTodos();
  }, []);

  // Clear message after 5 seconds
  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => {
        setMessage({ text: '', type: '' });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const fetchTodos = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/todos`);
      const data = await response.json();
      
      if (data.success) {
        setTodos(data.data);
      } else {
        showMessage('Failed to fetch todos', 'error');
      }
    } catch (error) {
      console.error('Error fetching todos:', error);
      showMessage('Error connecting to server', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addTodo = async (e) => {
    e.preventDefault();
    if (!newTodo.trim()) return;

    try {
      const response = await fetch(`${API_BASE_URL}/todos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: newTodo }),
      });

      const data = await response.json();
      
      if (data.success) {
        setTodos([...todos, data.data]);
        setNewTodo('');
        showMessage('Todo added successfully!', 'success');
      } else {
        showMessage(data.error || 'Failed to add todo', 'error');
      }
    } catch (error) {
      console.error('Error adding todo:', error);
      showMessage('Error adding todo', 'error');
    }
  };

  const deleteTodo = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/todos/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        setTodos(todos.filter(todo => todo.id !== id));
        showMessage('Todo deleted successfully!', 'success');
      } else {
        showMessage(data.error || 'Failed to delete todo', 'error');
      }
    } catch (error) {
      console.error('Error deleting todo:', error);
      showMessage('Error deleting todo', 'error');
    }
  };

  const toggleComplete = async (id) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    try {
      const response = await fetch(`${API_BASE_URL}/todos/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ completed: !todo.completed }),
      });

      const data = await response.json();
      
      if (data.success) {
        setTodos(todos.map(t => t.id === id ? data.data : t));
        showMessage(`Todo marked as ${!todo.completed ? 'completed' : 'pending'}!`, 'success');
      } else {
        showMessage(data.error || 'Failed to update todo', 'error');
      }
    } catch (error) {
      console.error('Error updating todo:', error);
      showMessage('Error updating todo', 'error');
    }
  };

  const startEditing = (id, text) => {
    setEditingId(id);
    setEditingText(text);
  };

  const saveEdit = async (id) => {
    if (!editingText.trim()) {
      setEditingId(null);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/todos/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: editingText }),
      });

      const data = await response.json();
      
      if (data.success) {
        setTodos(todos.map(t => t.id === id ? data.data : t));
        setEditingId(null);
        setEditingText('');
        showMessage('Todo updated successfully!', 'success');
      } else {
        showMessage(data.error || 'Failed to update todo', 'error');
      }
    } catch (error) {
      console.error('Error updating todo:', error);
      showMessage('Error updating todo', 'error');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  const summarizeAndSend = async () => {
    setSummarizing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.success) {
        showMessage(data.message, 'success');
        
        // Show the summary in a modal or alert
        if (data.summary) {
          alert(`Summary Generated:\n\n${data.summary}`);
        }
      } else {
        showMessage(data.error || 'Failed to generate summary', 'error');
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      showMessage('Error generating summary', 'error');
    } finally {
      setSummarizing(false);
    }
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
  };

  const pendingTodos = todos.filter(todo => !todo.completed);
  const completedTodos = todos.filter(todo => todo.completed);

  return (
    <div className="App">
      <div className="container">
        <header className="header">
          <h1>📋 Todo Summary Assistant</h1>
          <p>Manage your tasks and get AI-powered summaries sent to Slack</p>
        </header>

        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={addTodo} className="add-todo-form">
          <input
            type="text"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            placeholder="Enter a new todo..."
            className="todo-input"
            disabled={loading}
          />
          <button type="submit" disabled={loading || !newTodo.trim()}>
            Add Todo
          </button>
        </form>

        <div className="summary-section">
          <button 
            onClick={summarizeAndSend}
            disabled={pendingTodos.length === 0 || summarizing}
            className="summarize-btn"
          >
            {summarizing ? 'Generating Summary...' : '🤖 Generate & Send Summary to Slack'}
          </button>
          {pendingTodos.length === 0 && (
            <p className="no-todos">No pending todos to summarize!</p>
          )}
        </div>

        <div className="todos-container">
          <div className="pending-todos">
            <h2>📝 Pending Tasks ({pendingTodos.length})</h2>
            {loading ? (
              <div className="loading">Loading todos...</div>
            ) : pendingTodos.length === 0 ? (
              <div className="empty-state">
                <p>🎉 All done! No pending tasks.</p>
              </div>
            ) : (
              <ul className="todo-list">
                {pendingTodos.map(todo => (
                  <li key={todo.id} className="todo-item">
                    <div className="todo-content">
                      <input
                        type="checkbox"
                        checked={todo.completed}
                        onChange={() => toggleComplete(todo.id)}
                        className="todo-checkbox"
                      />
                      {editingId === todo.id ? (
                        <div className="edit-form">
                          <input
                            type="text"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="edit-input"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') saveEdit(todo.id);
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            autoFocus
                          />
                          <div className="edit-buttons">
                            <button onClick={() => saveEdit(todo.id)} className="save-btn">
                              Save
                            </button>
                            <button onClick={cancelEdit} className="cancel-btn">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className={`todo-text ${todo.completed ? 'completed' : ''}`}>
                          {todo.text}
                        </span>
                      )}
                    </div>
                    <div className="todo-actions">
                      {editingId !== todo.id && (
                        <>
                          <button 
                            onClick={() => startEditing(todo.id, todo.text)}
                            className="edit-btn"
                            title="Edit todo"
                          >
                            ✏️
                          </button>
                          <button 
                            onClick={() => deleteTodo(todo.id)}
                            className="delete-btn"
                            title="Delete todo"
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {completedTodos.length > 0 && (
            <div className="completed-todos">
              <h2>✅ Completed Tasks ({completedTodos.length})</h2>
              <ul className="todo-list">
                {completedTodos.map(todo => (
                  <li key={todo.id} className="todo-item completed">
                    <div className="todo-content">
                      <input
                        type="checkbox"
                        checked={todo.completed}
                        onChange={() => toggleComplete(todo.id)}
                        className="todo-checkbox"
                      />
                      <span className="todo-text completed">
                        {todo.text}
                      </span>
                    </div>
                    <div className="todo-actions">
                      <button 
                        onClick={() => deleteTodo(todo.id)}
                        className="delete-btn"
                        title="Delete todo"
                      >
                        🗑️
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
