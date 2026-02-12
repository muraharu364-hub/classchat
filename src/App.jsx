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
  Trash2, Plus, MessageSquare, ArrowLeft, Users, Lock, Heart, Sparkles 
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
      <div className="h-screen flex flex-col items-center justify-center bg-pink-50 p-6 text-center font-sans text-gray-700">
        <div className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] max-w-md w-full border-4 border-pink-100">
          <AlertCircle size={64} className="text-pink-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">設定が必要です💦</h2>
          <p className="text-gray-500 mb-6 text-sm">
            コードの <code>manualConfig</code> の部分に、<br/>
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
  
  // 自動スクロール用の参照
  const messagesEndRef = useRef(null);

  // 1. 自動スクロール機能
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // メッセージが増えたら自動で下までスクロール
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
        
        // 修正ポイント: 古い順（昇順）に並び替え
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

  // 1. かわいいログイン画面
  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-pink-100 via-purple-100 to-indigo-100 p-6 font-sans">
        <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] w-full max-w-sm text-center border-4 border-white">
          <div className="bg-gradient-to-tr from-pink-400 to-purple-500 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg transform hover:rotate-12 transition-transform cursor-default">
            <Heart size={48} className="text-white fill-white" />
          </div>
          <h1 className="text-4xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600">ClassHub</h1>
          <p className="text-gray-500 mb-8 font-medium">クラスのみんなと<br/>もっと仲良くなろう✨</p>
          
          {error && <div className="mb-6 p-3 bg-red-100 text-red-500 text-xs rounded-xl font-bold">{error}</div>}

          <div className="flex flex-col gap-3">
            <button onClick={() => handleLogin(() => signInWithPopup(auth, new GoogleAuthProvider()))} className="group relative flex items-center justify-center gap-3 bg-white text-gray-700 py-4 rounded-2xl font-bold shadow-md hover:shadow-lg hover:-translate-y-1 transition-all border-2 border-transparent hover:border-blue-100">
              <Chrome size={24} className="text-blue-500 group-hover:scale-110 transition-transform" /> 
              Googleで入る
            </button>
            <button onClick={() => handleLogin(() => signInWithPopup(auth, new GithubAuthProvider()))} className="group relative flex items-center justify-center gap-3 bg-gray-900 text-white py-4 rounded-2xl font-bold shadow-md hover:shadow-lg hover:-translate-y-1 transition-all">
              <Github size={24} className="group-hover:scale-110 transition-transform" /> 
              GitHubで入る
            </button>
            <button onClick={() => handleLogin(() => signInAnonymously(auth))} className="mt-2 text-sm text-gray-400 font-bold hover:text-pink-500 transition-colors flex items-center justify-center gap-1">
              <Sparkles size={14} /> 登録せずにのぞいてみる
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. かわいいロビー画面
  if (!currentRoom) {
    return (
      <div className="flex flex-col h-screen bg-pink-50 font-sans">
        <header className="bg-white/90 backdrop-blur-md p-4 px-6 flex justify-between items-center sticky top-0 z-10 shadow-sm border-b border-pink-100">
          <div className="flex items-center gap-2 font-black text-xl text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500">
            <Heart className="fill-pink-500 text-pink-500" size={24} /> ClassHub
          </div>
          <button onClick={() => signOut(auth)} className="bg-pink-100 hover:bg-pink-200 text-pink-500 p-2 rounded-full transition-colors">
            <LogOut size={20} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">ルームをえらんでね</h2>
              <p className="text-xs text-gray-400 font-bold mt-1">今日はどんな話をする？💭</p>
            </div>
            <button 
              onClick={() => setIsCreatingRoom(!isCreatingRoom)} 
              className="bg-gradient-to-r from-pink-500 to-purple-500 text-white px-5 py-3 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg hover:shadow-pink-200 hover:-translate-y-1 transition-all active:scale-95"
            >
              <Plus size={20} /> 作る
            </button>
          </div>

          {isCreatingRoom && (
            <div className="bg-white p-2 rounded-[2rem] shadow-xl mb-8 animate-in fade-in slide-in-from-top-4 border-4 border-purple-50">
              <form onSubmit={handleCreateRoom} className="flex gap-2 p-2">
                <input 
                  autoFocus
                  value={newRoomTopic}
                  onChange={(e) => setNewRoomTopic(e.target.value)}
                  placeholder="話題を入力（例：お昼なに食べた？）" 
                  className="flex-1 bg-gray-50 rounded-2xl px-6 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 transition-all font-medium text-gray-700"
                />
                <button type="submit" className="bg-purple-500 text-white px-6 rounded-2xl font-bold hover:bg-purple-600 transition-colors">OK</button>
              </form>
            </div>
          )}

          <div className="grid gap-4">
            {rooms.length === 0 && (
               <div className="text-center py-20 opacity-50">
                 <MessageSquare size={60} className="mx-auto mb-4 text-pink-300" />
                 <p className="font-bold text-gray-400">ルームがまだありません💦</p>
               </div>
            )}
            {rooms.map(room => (
              <div 
                key={room.id} 
                onClick={() => setCurrentRoom(room)} 
                className="group bg-white p-5 rounded-[2rem] shadow-sm border-2 border-transparent hover:border-pink-200 hover:shadow-xl cursor-pointer transition-all relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-pink-100 to-purple-100 rounded-bl-[4rem] -mr-8 -mt-8 opacity-50 group-hover:scale-110 transition-transform"></div>
                
                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2 relative z-10">
                  <span className="bg-pink-100 p-2 rounded-full text-pink-500 group-hover:bg-pink-500 group-hover:text-white transition-colors">
                    <MessageSquare size={18} />
                  </span>
                  {room.topic}
                </h3>
                <p className="text-xs text-gray-400 mt-2 font-bold ml-11">Created by {room.createdBy}</p>
                
                {room.creatorId === user.uid && (
                  <button 
                    onClick={async (e) => { e.stopPropagation(); if(window.confirm("本当に消しちゃう？")) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id)); }} 
                    className="absolute bottom-4 right-4 text-gray-300 hover:text-red-400 bg-white p-2 rounded-full hover:bg-red-50 transition-all shadow-sm z-20"
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

  // 3. かわいいチャット画面
  return (
    <div className="flex flex-col h-screen bg-[#FDF4F7] font-sans">
      <header className="bg-white/80 backdrop-blur-md p-4 flex justify-between items-center shadow-sm sticky top-0 z-10 border-b border-pink-100">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentRoom(null)} className="hover:bg-pink-100 text-pink-500 p-2 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="font-bold text-lg text-gray-800 leading-none">{currentRoom.topic}</h2>
            <span className="text-[10px] text-pink-400 font-bold flex items-center gap-1 mt-1">
              <Users size={10} /> みんなで会話中
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 max-w-3xl mx-auto w-full">
        {messages.map(msg => {
          const isMe = msg.userId === user.uid;
          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''} group`}>
              {msg.userPhoto ? (
                <img src={msg.userPhoto} className="w-10 h-10 rounded-full shadow-md border-2 border-white mt-auto" alt="" />
              ) : (
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md mt-auto border-2 border-white font-bold text-xs ${isMe ? 'bg-purple-300' : 'bg-pink-300'}`}>
                  {msg.user.slice(0,1)}
                </div>
              )}
              
              <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && <span className="text-[10px] font-bold text-gray-400 mb-1 ml-2">{msg.user}</span>}
                
                <div className={`
                  p-4 rounded-3xl shadow-sm relative text-sm font-medium leading-relaxed
                  ${isMe 
                    ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-br-none' 
                    : 'bg-white text-gray-700 rounded-bl-none border border-pink-50'}
                `}>
                  {msg.content}
                </div>
                
                {isMe && (
                   <button onClick={() => deleteMessage(msg.id)} className="text-[10px] text-gray-300 hover:text-red-400 mt-1 mr-1 opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1">
                     <Trash2 size={10}/> 削除
                   </button>
                )}
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <div className="text-center py-20">
            <div className="bg-white/50 inline-block p-6 rounded-full mb-4">
              <Sparkles size={40} className="text-yellow-400" />
            </div>
            <p className="text-gray-400 font-bold text-sm">一番乗りで話しかけてみよう！✨</p>
          </div>
        )}
        {/* スクロール用のダミー要素 */}
        <div ref={messagesEndRef} />
      </main>

      <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-pink-100 flex gap-2 sticky bottom-0 z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.02)]">
        <input 
          value={inputText} 
          onChange={e => setInputText(e.target.value)}
          placeholder="メッセージを入力..." 
          className="flex-1 bg-gray-50 rounded-full px-6 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 transition-all border border-gray-100"
        />
        <button type="submit" disabled={!inputText.trim()} className="bg-gradient-to-r from-pink-500 to-purple-500 text-white p-3 rounded-full hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:scale-100 disabled:shadow-none transition-all active:scale-95">
          <Send size={20} className="ml-0.5" />
        </button>
      </form>
    </div>
  );
};

export default App;
