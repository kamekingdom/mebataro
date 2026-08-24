import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: 'AIzaSyAWCTkz9nlChqZVW63h0pxJJ8YypNwxRPU',
  authDomain: 'mebataro.firebaseapp.com',
  projectId: 'mebataro',
  storageBucket: 'mebataro.firebasestorage.app',
  messagingSenderId: '427733180587',
  appId: '1:427733180587:web:6d3cd2fec0e8f9588717ee',
  measurementId: 'G-R7PDG0W7Q0',
}

export const firebaseApp = initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)
export const storage = getStorage(firebaseApp)
