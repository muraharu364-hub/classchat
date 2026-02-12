import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithPopup, 
  GoogleAuthProvider, 
  GithubAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  Hash, Send, LogOut, Github, Chrome, User, AlertCircle, 
  Trash2, Plus, MessageSquare, ArrowLeft, Users, Lock 
} from 'lucide-react';

// ==========================================
// 👇 ここをあなたの設定に書き換えてください
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

// 設定チェック用関数（ここから下は触らなくて大丈夫です）
const isConfigValid = (config) => {
  return config && config.apiKey && config.apiKey !== "ここにapiKeyを貼り付け";
};

// 安全に初期化
let app, auth, db;
try {
  if (isConfigValid(manualConfig)) {
    app = initializeApp(manualConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } else if (typeof __firebase_config !== 'undefined') {
    app = initializeApp(JSON.parse(__firebase_config));
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (e) {
  console.error("Firebase Init Error:", e);
}

const appId = isConfigValid(manualConfig) 
  ? 'class-hub-production' 
  : (typeof __app_id !== 'undefined' ? __app_id.replace(/[\/\.]/g, '_') : 'class-hub-production');

const App = () => {
  // そもそも初期化に失敗している場合のエラー表示
  if (!auth || !db) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-100 p-6 text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">設定が正しくありません</h2>
        <p className="text-gray-600 mb-4 text-sm max-w-md">
          Firebaseの設定が正しく貼り付けられていない可能性があります。<br />
          <code>manualConfig</code> の <code>" "</code> の中身をもう一度確認してください。
        </p>
      </div>
    );
  }

  const [user, setUser] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [newRoomTopic, setNewRoomTopic] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setError(null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    try {
      const roomsRef = collection(db, 'artifacts', appId, 'public', 'data', 'rooms');
      const q = query(roomsRef);
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const roomList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        roomList.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setRooms(roomList);
      }, (err) => {
        if (err.code === 'permission-denied') setError("PERMISSION_DENIED");
      });
      return () => unsubscribe();
    } catch (e) { console.error(e); }
  }, [user]);

  useEffect(() => {
    if (!user || !currentRoom) return;
    try {
      const msgsRef = collection(db, 'artifacts', appId, 'public', 'data', 'messages');
      const q = query(msgsRef);
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const allMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const roomMsgs = allMsgs.filter(msg => msg.roomId === currentRoom.id);
        roomMsgs.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setMessages(roomMsgs);
      }, (err) => console.error(err));
      return () => unsubscribe();
    } catch (e) { console.error(e); }
  }, [user, currentRoom]);

  const handleLogin = async (loginMethod) => {
    setError(null);
    try {
      await loginMethod();
    } catch (err) {
      setError(`ログインエラー: ${err.message}`);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomTopic.trim()) return;
    try {
      const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'rooms'), {
        topic: newRoomTopic,
        createdBy: user.displayName || "ゲスト",
        creatorId: user.uid,
        createdAt: serverTimestamp()
      });
      setCurrentRoom({ id: docRef.id, topic: newRoomTopic });
      setNewRoomTopic("");
      setIsCreatingRoom(false);
    } catch (err) {
      setError("ルーム作成失敗: " + err.message);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), {
        roomId: currentRoom.id,
        userId: user.uid,
        user: user.displayName || `ゲスト`,
        userPhoto: user.photoURL,
        content: inputText,
        createdAt: serverTimestamp()
      });
      setInputText("");
    } catch (e) {
      setError("送信エラー: " + e.message);
    }
  };

  if (error === "PERMISSION_DENIED") {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <Lock size={64} className="text-red-500 mb-6" />
        <h1 className="text-2xl font-bold text-gray-800 mb-4">権限エラー</h1>
        <p className="text-gray-600">Firestoreの「ルール」を公開済みにしてください。</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-6 text-center">
        <Hash size={60} className="text-green-400 mb-6 animate-bounce" />
        <h1 className="text-4xl font-black mb-2">ClassHub</h1>
        <p className="text-gray-400 mb-8">話題別チャットロビー</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button onClick={() => handleLogin(() => signInWithPopup(auth, new GoogleAuthProvider()))} className="flex items-center justify-center gap-3 bg-white text-black py-4 rounded-2xl font-bold hover:bg-gray-100 transition-all">
            <Chrome size={20} className="text-blue-500" /> Google
          </button>
          <button onClick={() => handleLogin(() => signInAnonymously(auth))} className="flex items-center justify-center gap-3 bg-transparent border-2 border-gray-700 text-gray-300 py-3 rounded-2xl font-bold hover:bg-gray-800 transition-all">
            <User size={18} /> ゲスト
          </button>
        </div>
      </div>
    );
  }

  if (!currentRoom) {
    return (
      <div className="flex flex-col h-screen bg-gray-50">
        <header className="bg-gray-900 text-white p-4 flex justify-between items-center">
          <div className="flex items-center gap-2 font-black text-xl"><Hash className="text-green-400" /> ClassHub</div>
          <button onClick={() => signOut(auth)} className="text-gray-400 hover:text-red-400"><LogOut size={20}/></button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-xl font-bold text-gray-800">ルームを選択</h2>
            <button onClick={() => setIsCreatingRoom(!isCreatingRoom)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-md">
              <Plus size={18} /> 新規ルーム
            </button>
          </div>
          {isCreatingRoom && (
            <form onSubmit={handleCreateRoom} className="bg-white p-4 rounded-2xl shadow-lg border-2 border-indigo-100 mb-6">
              <input 
                autoFocus
                value={newRoomTopic}
                onChange={(e) => setNewRoomTopic(e.target.value)}
                placeholder="話題を入力（例：宿題について）" 
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-xl font-bold">作成して入室</button>
            </form>
          )}
          <div className="grid gap-3">
            {rooms.map(room => (
              <div key={room.id} onClick={() => setCurrentRoom(room)} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:border-indigo-400 transition-all relative">
                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2"><MessageSquare size={18} className="text-indigo-500" />{room.topic}</h3>
                <p className="text-xs text-gray-500 mt-1">作成: {room.createdBy}</p>
                {room.creatorId === user.uid && (
                  <button onClick={async (e) => { e.stopPropagation(); if(window.confirm("削除しますか？")) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id)); }} className="absolute top-4 right-4 text-gray-300 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-indigo-600 text-white p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentRoom(null)} className="hover:bg-indigo-700 p-2 rounded-full transition-colors"><ArrowLeft size={20} /></button>
          <h2 className="font-bold text-lg">{currentRoom.topic}</h2>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl mx-auto w-full">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.userId === user.uid ? 'flex-row-reverse' : ''}`}>
            <div className={`p-3 rounded-2xl shadow-sm border max-w-[80%] ${msg.userId === user.uid ? 'bg-indigo-600 text-white' : 'bg-white text-gray-800'}`}>
              <p className="text-xs font-bold opacity-70 mb-1">{msg.user}</p>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
      </main>
      <form onSubmit={handleSendMessage} className="p-4 bg-white border-t flex gap-2">
        <input value={inputText} onChange={e => setInputText(e.target.value)} placeholder="メッセージを入力..." className="flex-1 bg-gray-100 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <button type="submit" disabled={!inputText.trim()} className="bg-indigo-600 text-white p-3 rounded-2xl hover:bg-indigo-700 shadow-lg transition-all active:scale-95"><Send size={22} /></button>
      </form>
    </div>
  );
};

export default App;
