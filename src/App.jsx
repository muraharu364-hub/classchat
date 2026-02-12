import React, { useState, useEffect, useRef } from 'react';
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
  Trash2, Plus, MessageSquare, ArrowLeft, Users, Lock, Sparkles, Heart
} from 'lucide-react';

// ==========================================
// 👇 ここにあなたのFirebase設定を貼り付けてください
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

// 設定チェック
const isConfigValid = (config) => {
  return config && config.apiKey && config.apiKey !== "ここにapiKeyを貼り付け";
};

// 安全に初期化
let app = null;
let auth = null;
let db = null;

try {
  if (isConfigValid(manualConfig)) {
    app = initializeApp(manualConfig);
  } else if (typeof __firebase_config !== 'undefined') {
    app = initializeApp(JSON.parse(__firebase_config));
  }
  
  if (app) {
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
  if (!auth || !db) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-blue-50 p-6 text-center font-sans text-gray-700">
        <div className="bg-white p-10 rounded-[3rem] shadow-xl max-w-md w-full border-4 border-white">
          <AlertCircle size={64} className="text-blue-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">設定が必要です☁️</h2>
          <p className="text-gray-500 mb-6 text-sm">
            コードの <code>manualConfig</code> の部分に<br/>
            Firebaseの設定を貼り付けてね！
          </p>
        </div>
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
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'rooms'));
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
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'messages'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const allMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const roomMsgs = allMsgs.filter(msg => msg.roomId === currentRoom.id);
        roomMsgs.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
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
      if (err.code === 'auth/unauthorized-domain') {
        setError("URLの許可が必要です！Firebaseで設定してね。");
      } else {
        setError("ログインできませんでした😢");
      }
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
      setError("ルームが作れませんでした😢");
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
      setError("送信失敗... " + e.message);
    }
  };

  const deleteMessage = async (id) => {
    if(window.confirm("このメッセージを消しちゃう？")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'messages', id));
    }
  };

  const deleteRoom = async (e, roomId) => {
    e.stopPropagation();
    if(window.confirm("このルームを削除しますか？")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId));
    }
  };

  if (error === "PERMISSION_DENIED") {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-red-50 p-6 text-center font-sans">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full">
          <Lock size={64} className="text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">カギがかかっています🔒</h1>
          <p className="text-gray-500 text-sm">Firebaseの「ルール」設定を公開済みにしてね！</p>
        </div>
      </div>
    );
  }

  // 1. ログイン画面（ブルーベース）
  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 via-indigo-50 to-purple-100 p-6 font-sans">
        <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[3rem] shadow-[0_20px_60px_rgba(100,149,237,0.2)] w-full max-w-sm text-center border-4 border-white">
          <div className="bg-gradient-to-tr from-blue-400 to-indigo-400 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200">
            <Heart size={48} className="text-white fill-white animate-pulse" />
          </div>
          <h1 className="text-4xl font-black mb-2 text-gray-800 tracking-tight">ClassHub</h1>
          <p className="text-gray-500 mb-8 font-bold text-sm">クラスのみんなとつながろう✨</p>
          
          {error && <div className="mb-6 p-3 bg-red-100 text-red-500 text-xs rounded-xl font-bold">{error}</div>}

          <div className="flex flex-col gap-3">
            <button onClick={() => handleLogin(() => signInWithPopup(auth, new GoogleAuthProvider()))} className="group flex items-center justify-center gap-3 bg-white text-gray-700 py-4 rounded-2xl font-bold shadow-md hover:shadow-xl hover:-translate-y-1 transition-all border-2 border-transparent hover:border-blue-200">
              <Chrome size={24} className="text-blue-500" /> Googleで入る
            </button>
            <button onClick={() => handleLogin(() => signInWithPopup(auth, new GithubAuthProvider()))} className="group flex items-center justify-center gap-3 bg-gray-900 text-white py-4 rounded-2xl font-bold shadow-md hover:shadow-xl hover:-translate-y-1 transition-all">
              <Github size={24} /> GitHubで入る
            </button>
            <button onClick={() => handleLogin(() => signInAnonymously(auth))} className="mt-2 text-sm text-blue-400 font-bold hover:text-blue-600 transition-colors flex items-center justify-center gap-1">
              <Sparkles size={14} /> 登録せずにのぞいてみる
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. ロビー画面（丸みを帯びたデザイン）
  if (!currentRoom) {
    return (
      <div className="flex flex-col h-screen bg-[#F0F4F8] font-sans">
        <header className="bg-white/80 backdrop-blur-md p-5 px-6 flex justify-between items-center sticky top-0 z-10 shadow-sm border-b border-white">
          <div className="flex items-center gap-2 font-black text-xl text-gray-800">
            <span className="bg-blue-100 p-2 rounded-full text-blue-500"><Hash size={20} /></span>
            ClassHub
          </div>
          <button onClick={() => signOut(auth)} className="bg-gray-100 hover:bg-gray-200 text-gray-500 p-3 rounded-full transition-colors">
            <LogOut size={20} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">ルームをえらんでね</h2>
              <p className="text-xs text-gray-400 font-bold mt-1 ml-1">今日はどんな話をする？💭</p>
            </div>
            <button 
              onClick={() => setIsCreatingRoom(!isCreatingRoom)} 
              className="bg-blue-500 text-white px-6 py-3 rounded-[2rem] text-sm font-bold flex items-center gap-2 shadow-lg hover:shadow-blue-200 hover:-translate-y-1 transition-all active:scale-95"
            >
              <Plus size={20} /> 作る
            </button>
          </div>

          {isCreatingRoom && (
            <div className="bg-white p-2 rounded-[2.5rem] shadow-xl mb-8 animate-in fade-in slide-in-from-top-4 border-4 border-blue-50">
              <form onSubmit={handleCreateRoom} className="flex gap-2 p-2">
                <input 
                  autoFocus
                  value={newRoomTopic}
                  onChange={(e) => setNewRoomTopic(e.target.value)}
                  placeholder="話題を入力（例：お昼なに食べた？）" 
                  className="flex-1 bg-gray-50 rounded-[2rem] px-6 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all font-bold text-gray-700"
                />
                <button type="submit" className="bg-blue-500 text-white px-6 rounded-[2rem] font-bold hover:bg-blue-600 transition-colors">OK</button>
              </form>
            </div>
          )}

          <div className="grid gap-4">
            {rooms.length === 0 && (
               <div className="text-center py-20 opacity-50">
                 <MessageSquare size={60} className="mx-auto mb-4 text-blue-200" />
                 <p className="font-bold text-gray-400">ルームがまだありません💦</p>
               </div>
            )}
            {rooms.map(room => (
              <div 
                key={room.id} 
                onClick={() => setCurrentRoom(room)} 
                className="group bg-white p-6 rounded-[2.5rem] shadow-sm border-2 border-transparent hover:border-blue-200 hover:shadow-xl cursor-pointer transition-all relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-[4rem] -mr-8 -mt-8 group-hover:scale-110 transition-transform"></div>
                
                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-3 relative z-10">
                  <span className="bg-blue-50 p-3 rounded-full text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                    <MessageSquare size={20} />
                  </span>
                  {room.topic}
                </h3>
                <p className="text-xs text-gray-400 mt-2 font-bold ml-14">Created by {room.createdBy}</p>
                
                {room.creatorId === user.uid && (
                  <button 
                    onClick={async (e) => { e.stopPropagation(); if(window.confirm("本当に消しちゃう？")) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id)); }} 
                    className="absolute bottom-6 right-6 text-gray-300 hover:text-red-400 bg-white p-2 rounded-full hover:bg-red-50 transition-all shadow-sm z-20"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // 3. チャット画面（左アイコン・掲示板スタイル）
  return (
    <div className="flex flex-col h-screen bg-[#F0F4F8] font-sans">
      <header className="bg-white/80 backdrop-blur-md p-4 px-6 flex justify-between items-center shadow-sm sticky top-0 z-10 border-b border-white">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentRoom(null)} className="hover:bg-blue-50 text-blue-500 p-3 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="font-bold text-lg text-gray-800 leading-none">{currentRoom.topic}</h2>
            <span className="text-[10px] text-blue-400 font-bold flex items-center gap-1 mt-1">
              <Users size={12} /> 会話中
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 max-w-3xl mx-auto w-full">
        {messages.map(msg => {
          const isMe = msg.userId === user.uid;
          return (
            // 常に左並び（flex-row）で、アイコンも左に表示
            <div key={msg.id} className="flex gap-3 group items-start">
              {/* アイコン（小さく丸く） */}
              {msg.userPhoto ? (
                <img src={msg.userPhoto} className="w-8 h-8 rounded-full shadow-md border-2 border-white shrink-0 mt-1" alt="" />
              ) : (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md border-2 border-white font-bold text-xs shrink-0 mt-1 ${isMe ? 'bg-indigo-300' : 'bg-blue-300'}`}>
                  {msg.user.slice(0,1)}
                </div>
              )}
              
              <div className="flex flex-col max-w-[85%]">
                <span className="text-[10px] font-bold text-gray-400 mb-1 ml-1">
                  {msg.user} {isMe && <span className="bg-blue-100 text-blue-600 px-1.5 rounded-md ml-1">自分</span>}
                </span>
                
                {/* 吹き出し: 自分と相手で色を変えて区別 */}
                <div className={`
                  p-4 rounded-[1.5rem] shadow-sm text-sm font-medium leading-relaxed relative
                  ${isMe 
                    ? 'bg-white border-2 border-blue-100 text-gray-800 rounded-tl-none' 
                    : 'bg-white text-gray-700 rounded-tl-none border-2 border-transparent'}
                `}>
                  {msg.content}
                </div>
                
                {isMe && (
                   <button onClick={() => deleteMessage(msg.id)} className="text-[10px] text-gray-300 hover:text-red-400 mt-1 ml-2 opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1 self-start">
                     <Trash2 size={10}/> 削除
                   </button>
                )}
              </div>
            </div>
          );
        })}
        
        {messages.length === 0 && (
          <div className="text-center py-20">
            <div className="bg-white p-6 rounded-full mb-4 inline-block shadow-sm">
              <Sparkles size={32} className="text-yellow-400" />
            </div>
            <p className="text-gray-400 font-bold text-sm">一番乗りで話しかけてみよう！✨</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-blue-50 flex gap-2 sticky bottom-0 z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.02)]">
        <input 
          value={inputText} 
          onChange={e => setInputText(e.target.value)}
          placeholder="メッセージを入力..." 
          className="flex-1 bg-gray-50 rounded-[2rem] px-6 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all border border-gray-100 font-medium"
        />
        <button type="submit" disabled={!inputText.trim()} className="bg-blue-500 text-white p-3 rounded-full hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:scale-100 disabled:shadow-none transition-all active:scale-95">
          <Send size={20} className="ml-0.5" />
        </button>
      </form>
    </div>
  );
};

export default App;
