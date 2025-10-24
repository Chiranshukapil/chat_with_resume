import * as dotenv from 'dotenv';
import readlineSync from 'readline-sync';
import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeStore } from '@langchain/pinecone';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { createStuffDocumentsChain } from 'langchain/chains/combine_documents';
import { createRetrievalChain } from 'langchain/chains/retrieval';
import { createHistoryAwareRetriever } from 'langchain/chains/history_aware_retriever';

dotenv.config();

const RESUME_NAMESPACE = 'Chiranshu_resume';

async function main() {
  const pinecone = new Pinecone();
  const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);
  const embeddings = new GoogleGenerativeAIEmbeddings({ model: 'text-embedding-004' });
  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
    namespace: RESUME_NAMESPACE,
  });
  const retriever = vectorStore.asRetriever();
  const model = new ChatGoogleGenerativeAI({
    model: 'gemini-2.0-flash',
    temperature: 0.5,
  });

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

  const chatHistory = [];
  console.log('✅ Chatbot initialized. Ask questions about the resume! Type "exit" to quit.');

  while (true) {
    const question = readlineSync.question('You: ');
    if (question.toLowerCase() === 'exit') {
      console.log('Goodbye!');
      break;
    }

    const response = await conversationalRetrievalChain.invoke({
      chat_history: chatHistory,
      input: question,
    });
    
    console.log(`AI: ${response.answer}`);

    chatHistory.push(
        { role: 'user', content: question },
        { role: 'ai', content: response.answer }
    );
  }
}

main();