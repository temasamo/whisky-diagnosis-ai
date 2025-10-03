import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import { initializeRAGDatabase } from '../lib/rag-database'

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // RAGデータベースの初期化
    try {
      initializeRAGDatabase()
      console.log('RAG database initialized successfully')
    } catch (error) {
      console.error('RAG database initialization failed:', error)
    }
  }, [])

  return <Component {...pageProps} />
}
