import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import multer from 'multer';
import { randomUUID } from 'crypto';
import path from 'path';

import { Pinecone } from '@pinecone-database/pinecone';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { PineconeStore } from '@langchain/pinecone';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { createStuffDocumentsChain } from 'langchain/chains/combine_documents';
import { createRetrievalChain } from 'langchain/chains/retrieval';
import { createHistoryAwareRetriever } from 'langchain/chains/history_aware_retriever';

dotenv.config();

const upload = multer({ dest: 'uploads/' });

async function ingestDocument(filePath, namespace) {
  console.log(`Starting ingestion for ${filePath} with namespace ${namespace}`);
  const loader = new PDFLoader(filePath);
  const rawDocs = await loader.load();

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 100,
  });
  const chunkedDocs = await textSplitter.splitDocuments(rawDocs);

  const embeddings = new GoogleGenerativeAIEmbeddings({ model: 'text-embedding-004' });
  const pinecone = new Pinecone();
  const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

  await PineconeStore.fromDocuments(chunkedDocs, embeddings, {
    pineconeIndex,
    namespace: namespace,
  });
  console.log(`Ingestion complete for namespace ${namespace}`);
}

const app = express();
const PORT = process.env.PORT || 8000;
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Resume Chatbot API is running!');
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  try {
    const filePath = req.file.path;
    const uniqueNamespace = randomUUID(); 
    await ingestDocument(filePath, uniqueNamespace);
    res.json({ namespace: uniqueNamespace, message: 'File uploaded and processed successfully.' });
  } catch (error) {
    console.error('Error during upload and ingestion:', error);
    res.status(500).json({ error: 'Failed to process file.' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { question, history, namespace } = req.body;
    if (!question || !namespace) {
      return res.status(400).json({ error: 'Question and namespace are required.' });
    }

    const pinecone = new Pinecone();
    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);
    const embeddings = new GoogleGenerativeAIEmbeddings({ model: 'text-embedding-004' });
    
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex,
      namespace: namespace,
    });
    const retriever = vectorStore.asRetriever();
    
    const model = new ChatGoogleGenerativeAI({ model: 'gemini-2.0-flash', temperature: 0.5 });

    const contextualizeQPrompt = ChatPromptTemplate.fromMessages([
        ['system', 'Given a chat history and the latest user question which might reference context in the chat history, formulate a standalone question which can be understood without the chat history. Do NOT answer the question, just reformulate it if needed and otherwise return it as is.'],
        new MessagesPlaceholder('chat_history'),
        ['user', '{input}'],
    ]);
    const historyAwareRetrieverChain = await createHistoryAwareRetriever({
        llm: model,
        retriever,
        rephrasePrompt: contextualizeQPrompt,
    });

    const answerPrompt = ChatPromptTemplate.fromMessages([
        ['system', 'Answer the user\'s question based only on the following context:\n\n{context}'],
        new MessagesPlaceholder('chat_history'),
        ['user', '{input}'],
    ]);
    const documentChain = await createStuffDocumentsChain({ llm: model, prompt: answerPrompt });
    const conversationalRetrievalChain = await createRetrievalChain({
        retriever: historyAwareRetrieverChain,
        combineDocsChain: documentChain,
    });

    const response = await conversationalRetrievalChain.invoke({
      chat_history: history || [],
      input: question,
    });

    res.json({ answer: response.answer });
  } catch (error) {
    console.error('Error processing chat request:', error);
    res.status(500).json({ error: 'An error occurred.' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});