import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { MessageSquare, Users, Bell, User, Send, Smile, Hash, Info, Reply, X, LogOut, Shield, AlertTriangle } from 'lucide-react';

// ==========================================
// 👇 ここにFirebaseの設定を貼り付けてください！
// ==========================================
const manualConfig = {
  apiKey: "AIzaSyATsr01BJ6RihOW5SUhW4aXfx7SOdaxSd0",
  authDomain: "classhub-d8c5f.firebaseapp.com",
  projectId: "classhub-d8c5f",
  storageBucket: "classhub-d8c5f.firebasestorage.app",
  messagingSenderId: "1015431116758",
  appId: "1:1015431116758:web:f647345b8610eea810d677",
  measurementId: "G-TLD75RQYVX"
};
// ==========================================

// 設定を読み込むロジック
const getFirebaseConfig = () => {
  if (typeof __firebase_config !== 'undefined') return JSON.parse(__firebase_config);
  if (manualConfig.apiKey !== "ここにapiKeyを貼り付け") return manualConfig;
  try {
    if (import.meta.env.VITE_FIREBASE_API_KEY) {
      return {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID
      };
    }
  } catch (e) {}
  return null;
};

const firebaseConfig = getFirebaseConfig();
const app = firebaseConfig ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const appId = 'class-hub-production'; // 公開用ID

const App = () => {
  // 設定がない場合のエラー表示
  if (!app) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-100 p-6 text-center">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md">
          <AlertTriangle size={48} className="text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">設定が必要です</h2>
          <p className="text-gray-600 mb-4 text-sm">
            Firebaseの設定が見つかりません。<br />
            <code>src/App.jsx</code> ファイルを開き、
            <code>manualConfig</code> の部分にあなたの設定を貼り付けてください。
          </p>
        </div>
      </div>
    );
  }

  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [error, setError] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // 1. 認証監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. データ取得
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'messages'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // 日付順ソート（新しい順）
        msgs.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
          return timeB - timeA;
        });
        setMessages(msgs);
        setError(null);
      }, (err) => {
        console.error("Firestore error:", err);
        if (err.code === 'permission-denied') setError("読み込み権限がありません。");
      }
    );
    return () => unsubscribe();
  }, [user]);

  // Googleログイン
  const handleGoogleLogin = async () => {
    setError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      console.error("Login Error:", err);
      if (err.code === 'auth/unauthorized-domain') {
        setError("ドメイン許可エラー: FirebaseコンソールでこのURLを承認してください。");
      } else {
        setError("ログインに失敗しました。");
      }
    }
  };

  // ゲストログイン
  const handleGuestLogin = async () => {
    try { await signInAnonymously(auth); } catch (err) { setError("ゲストログイン失敗"); }
  };

  // ログアウト
  const handleLogout = async () => {
    try { await signOut(auth); setMessages([]); } catch (err) {}
  };

  // 送信
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !user) return;
    const text = inputText;
    const currentUserId = user.uid;
    const userName = user.displayName || `ゲスト(${currentUserId.slice(0, 4)})`;
    const userPhoto = user.photoURL || null;
    setInputText(""); 

    try {
      if (replyTo) {
        const messageRef = doc(db, 'artifacts', appId, 'public', 'data', 'messages', replyTo.id);
        const newReply = {
          id: crypto.randomUUID(), userId: currentUserId, user: userName, userPhoto: userPhoto,
          content: text, createdAt: new Date().toISOString()
        };
        await updateDoc(messageRef, { replies: [...(replyTo.replies || []), newReply] });
        setReplyTo(null);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), {
          userId: currentUserId, user: userName, userPhoto: userPhoto, content: text,
          createdAt: serverTimestamp(), type: "regular", reactions: {}, replies: []
        });
      }
    } catch (err) { setError("送信失敗"); }
  };

  if (isAuthLoading) return <div className="h-screen flex items-center justify-center">読み込み中...</div>;

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-indigo-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm text-center">
          <Hash size={40} className="text-indigo-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-6">ClassHub</h1>
          {error && <div className="mb-4 text-red-500 text-sm">{error}</div>}
          <button onClick={handleGoogleLogin} className="w-full mb-3 bg-white border border-gray-300 py-3 rounded-lg font-bold">Googleでログイン</button>
          <button onClick={handleGuestLogin} className="w-full bg-indigo-100 text-indigo-700 py-3 rounded-lg font-bold">ゲスト参加</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-indigo-600 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2"><Hash size={24} /><h1 className="text-xl font-bold">ClassHub</h1></div>
        <div className="flex items-center gap-3">
          {user.photoURL ? <img src={user.photoURL} className="w-8 h-8 rounded-full" /> : <div className="w-8 h-8 bg-indigo-400 rounded-full flex items-center justify-center text-xs">{user.displayName?.[0]||'G'}</div>}
          <button onClick={handleLogout}><LogOut size={16} /></button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto pb-32">
        <div className="p-4 space-y-6 max-w-2xl mx-auto">
          {messages.map((msg) => (
            <div key={msg.id} className="space-y-2">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-indigo-600">{msg.user}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <div className="flex justify-end pt-2 border-t border-gray-50">
                  <button onClick={() => setReplyTo(msg)} className="text-xs text-gray-400 flex items-center gap-1"><Reply size={14}/>返信</button>
                </div>
              </div>
              {msg.replies && msg.replies.map(reply => (
                <div key={reply.id} className="ml-8 bg-indigo-50 p-3 rounded-lg text-xs">
                  <span className="font-bold text-indigo-500 block mb-1">{reply.user}</span>
                  {reply.content}
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 pb-8">
        <div className="max-w-2xl mx-auto">
          {replyTo && <div className="bg-indigo-50 p-2 mb-2 text-xs flex justify-between"><span>{replyTo.user}へ返信</span><X size={14} onClick={()=>setReplyTo(null)}/></div>}
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input value={inputText} onChange={e=>setInputText(e.target.value)} className="flex-1 bg-gray-100 rounded-full px-4 py-2" placeholder="メッセージ..." />
            <button type="submit" disabled={!inputText.trim()} className="bg-indigo-600 text-white p-2 rounded-full"><Send size={20}/></button>
          </form>
        </div>
      </div>
    </div>
  );
};
export default App;
