import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { FiUploadCloud, FiSend, FiUser, FiCpu, FiPlus, FiLoader } from 'react-icons/fi';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [namespace, setNamespace] = useState(null); 
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [fileName, setFileName] = useState(''); 

  const messagesEndRef = useRef(null);
  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };
  useEffect(scrollToBottom, [messages]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadStatus('Please select a file first.');
      return;
    }
    setIsLoading(true);
    setUploadStatus('Uploading and processing...');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed.');

      const data = await response.json();
      setNamespace(data.namespace); 
      setMessages([{ sender: 'ai', text: `Ready! Ask me anything about **${file.name}**.` }]); 
      setUploadStatus('Processing complete!');
    } catch (error) {
      setUploadStatus(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input || isLoading || !namespace) return;

    const userMessage = { sender: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setInput('');

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: input,
          namespace: namespace, 
          history: messages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'ai',
            content: msg.text
          }))
        }),
      });
      if (!response.ok) throw new Error('Network response was not ok');

      const data = await response.json();
      const aiMessage = { sender: 'ai', text: data.answer };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage = { sender: 'ai', text: "Sorry, I'm having trouble connecting to the server." };
      setMessages(prev => [...prev, errorMessage]);
    }
    setIsLoading(false);
  };
  
  const handleNewChat = () => {
    setNamespace(null);
    setMessages([]);
    setFile(null);
    setUploadStatus('');
    setFileName('');
  };

  if (!namespace) {
    return (
      <div className="flex flex-col h-screen bg-slate-900 text-slate-200 items-center justify-center p-4">
        <div className="w-full max-w-lg bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8 text-center">
          <FiUploadCloud className="mx-auto h-16 w-16 text-indigo-500" />
          <h1 className="text-3xl font-bold mt-4 mb-2">Upload a Resume to Chat</h1>
          <p className="text-slate-400 mb-6">Upload a PDF to begin an interactive Q&A session.</p>
          
          <div className="flex flex-col items-center space-y-4">
            <label 
              htmlFor="file-upload" 
              className="w-full cursor-pointer bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
            >
              <FiUploadCloud />
              <span>{fileName || 'Choose a PDF file...'}</span>
            </label>
            <input 
              id="file-upload"
              type="file" 
              accept=".pdf" 
              onChange={handleFileChange}
              className="hidden"
            />
            
            <button
              onClick={handleUpload}
              disabled={isLoading || !file}
              className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-colors"
            >
              {isLoading ? (
                <FiLoader className="animate-spin" />
              ) : (
                <FiSend />
              )}
              <span>{isLoading ? 'Processing...' : 'Upload and Start Chat'}</span>
            </button>
            
            {uploadStatus && (
              <p className={`text-sm mt-4 ${uploadStatus.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
                {uploadStatus}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-200">
      <header className="bg-slate-800 border-b border-slate-700 shadow-md p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Chat with: {fileName}</h1>
        <button
          onClick={handleNewChat}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
        >
          <FiPlus />
          <span>New Chat</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg, index) => (
          <div key={index} className={`flex items-start space-x-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            
            <div className={`h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center ${msg.sender === 'user' ? 'bg-indigo-600' : 'bg-slate-700'}`}>
              {msg.sender === 'user' ? <FiUser size={16} /> : <FiCpu size={16} />}
            </div>
            
            <div 
              className={`chat-bubble max-w-xl rounded-2xl px-5 py-3 text-sm ${
                msg.sender === 'user' 
                  ? 'bg-indigo-600 rounded-br-none' 
                  : 'bg-slate-700 rounded-bl-none'
              }`}
            >
              <ReactMarkdown>{msg.text}</ReactMarkdown>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex items-start space-x-3 justify-start">
            <div className="h-8 w-8 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center">
              <FiCpu size={16} />
            </div>
            <div className="bg-slate-700 rounded-2xl px-5 py-3 rounded-bl-none">
              <div className="flex items-center space-x-1">
                <span className="h-2 w-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="h-2 w-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="h-2 w-2 bg-slate-400 rounded-full animate-bounce"></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="p-4 bg-slate-800 border-t border-slate-700">
        <form onSubmit={handleSubmit} className="flex space-x-3 max-w-4xl mx-auto">
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="Ask a question about the document..." 
            className="flex-1 p-3 bg-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button 
            type="submit" 
            disabled={isLoading} 
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <FiSend size={18} />
          </button>
        </form>
      </footer>
    </div>
  );
}

export default App;