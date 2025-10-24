import * as dotenv from 'dotenv';
import { Pinecone } from '@pinecone-database/pinecone';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { PineconeStore } from '@langchain/pinecone';

dotenv.config();

const PDF_PATH = './data/Chiranshu_resume.pdf'; 

const RESUME_NAMESPACE = 'Chiranshu_resume'; 

async function ingestResume() {
  console.log('--- Starting ingestion process ---');

  try {
    const pdfLoader = new PDFLoader(PDF_PATH);
    const rawDocs = await pdfLoader.load();
    console.log(`✅ Loaded ${rawDocs.length} document(s) from the PDF.`);

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000, 
      chunkOverlap: 100, 
    });
    const chunkedDocs = await textSplitter.splitDocuments(rawDocs);
    console.log(`✅ Split document into ${chunkedDocs.length} chunks.`);

    const embeddings = new GoogleGenerativeAIEmbeddings({ model: 'text-embedding-004' });
    const pinecone = new Pinecone();
    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);
    console.log('✅ Initialized models and Pinecone client.');

    console.log(`⏳ Uploading ${chunkedDocs.length} chunks to Pinecone namespace: "${RESUME_NAMESPACE}"...`);
    await PineconeStore.fromDocuments(chunkedDocs, embeddings, {
      pineconeIndex,
      namespace: RESUME_NAMESPACE, 
      maxConcurrency: 5, 
    });
    console.log('✅✅✅ Ingestion complete! Your resume is now in the vector database.');

  } catch (error) {
    console.error('❌ Error during ingestion process:', error);
  }
}

ingestResume();