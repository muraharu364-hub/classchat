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
// 👇 あなたのFirebase設定を貼り付けてください
// ==========================================
const firebaseConfig = {
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
  return config.apiKey && config.apiKey !== "ここにapiKeyを貼り付け";
};

// 初期化
let app, auth, db;
if (isConfigValid(manualConfig)) {
  try {
    app = initializeApp(manualConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase Initialization Error:", e);
  }
} else if (typeof __firebase_config !== 'undefined') {
  try {
    app = initializeApp(JSON.parse(__firebase_config));
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {}
}

// IDの安全化
const appId = isConfigValid(manualConfig) 
  ? 'class-hub-production' 
  : (typeof __app_id !== 'undefined' ? __app_id.replace(/[\/\.]/g, '_') : 'class-hub-production');

const App = () => {
  if (!auth) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-100 p-6 text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">設定が必要です</h2>
        <p className="text-gray-600 mb-4 text-sm max-w-md">
          Firebaseの設定が見つからないか、正しくありません。<br />
          <code>src/App.jsx</code> ファイルの <code>manualConfig</code> に設定を貼り付けてください。
        </p>
      </div>
    );
  }

  const [user, setUser] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(null); // 現在いるルーム（nullならロビー）
  const [rooms, setRooms] = useState([]); // ルーム一覧
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [newRoomTopic, setNewRoomTopic] = useState(""); // 新規ルーム作成用
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [error, setError] = useState(null);

  // 1. ログイン監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setError(null);
    });
    return () => unsubscribe();
  }, []);

  // 2. ルーム一覧の取得（ロビー用）
  useEffect(() => {
    if (!user) return;
    try {
      const roomsRef = collection(db, 'artifacts', appId, 'public', 'data', 'rooms');
      const q = query(roomsRef);
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const roomList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // 新しい順に並び替え
        roomList.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setRooms(roomList);
      }, (err) => handleFirestoreError(err));
      return () => unsubscribe();
    } catch (e) {
      console.error(e);
    }
  }, [user]);

  // 3. メッセージの取得（ルーム入室時のみ）
  useEffect(() => {
    if (!user || !currentRoom) return;
    try {
      // 全メッセージを取得してから、今のルームのものだけフィルターする（複合クエリエラー回避のため）
      const msgsRef = collection(db, 'artifacts', appId, 'public', 'data', 'messages');
      const q = query(msgsRef);
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const allMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // 現在のルームIDと一致するものだけ抽出
        const roomMsgs = allMsgs.filter(msg => msg.roomId === currentRoom.id);
        // 新しい順にソート
        roomMsgs.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setMessages(roomMsgs);
      }, (err) => {
        if (err.code !== 'permission-denied') setError("メッセージ読込エラー");
      });
      return () => unsubscribe();
    } catch (e) {
      setError("メッセージ取得エラー");
    }
  }, [user, currentRoom]);

  const handleFirestoreError = (err) => {
    console.error(err);
    if (err.code === 'permission-denied') {
      setError("PERMISSION_DENIED");
    } else {
      setError(`読み込みエラー: ${err.message}`);
    }
  };

  const handleLogin = async (loginMethod) => {
    setError(null);
    try {
      await loginMethod();
    } catch (err) {
      if (err.code === 'auth/unauthorized-domain') {
        setError("ドメイン許可エラー: FirebaseコンソールでこのURLを承認してください。");
      } else {
        setError(`ログインエラー: ${err.message}`);
      }
    }
  };

  // 新しいルームを作成する
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
      // 作成したらすぐその部屋に入る
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
        roomId: currentRoom.id, // どの部屋のメッセージか記録
        userId: user.uid,
        user: user.displayName || `ゲスト(${user.uid.slice(0,4)})`,
        userPhoto: user.photoURL,
        content: inputText,
        createdAt: serverTimestamp()
      });
      setInputText("");
    } catch (e) {
      setError("送信エラー: " + e.message);
    }
  };

  const deleteMessage = async (id) => {
    if(window.confirm("削除しますか？")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'messages', id));
    }
  };

  const deleteRoom = async (e, roomId) => {
    e.stopPropagation(); // 親要素のクリックイベントを止める
    if(window.confirm("このルームを削除しますか？")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId));
    }
  };

  // --- 画面描画 ---

  // 1. 権限エラー画面
  if (error === "PERMISSION_DENIED") {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <Lock size={64} className="text-red-500 mb-6" />
        <h1 className="text-2xl font-bold text-gray-800 mb-4">データベース権限エラー</h1>
        <p>Firebaseコンソールの「Firestore Database ＞ ルール」設定を確認してください。</p>
      </div>
    );
  }

  // 2. ログイン画面
  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-6 text-center">
        <Hash size={60} className="text-green-400 mb-6 animate-bounce" />
        <h1 className="text-4xl font-black mb-2">ClassHub</h1>
        <p className="text-gray-400 mb-8">クラス専用の話題別チャット</p>
        
        {error && <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-xl text-red-200 text-sm">{error}</div>}

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button onClick={() => handleLogin(() => signInWithPopup(auth, new GoogleAuthProvider()))} className="flex items-center justify-center gap-3 bg-white text-black py-4 rounded-2xl font-bold hover:bg-gray-100 transition-all">
            <Chrome size={20} className="text-blue-500" /> Googleでログイン
          </button>
          <button onClick={() => handleLogin(() => signInWithPopup(auth, new GithubAuthProvider()))} className="flex items-center justify-center gap-3 bg-gray-800 text-white py-4 rounded-2xl font-bold hover:bg-gray-700 transition-all border border-gray-700">
            <Github size={20} /> GitHubでログイン
          </button>
          <div className="flex items-center my-2 text-gray-600"><span className="px-3 text-[10px]">OR</span></div>
          <button onClick={() => handleLogin(() => signInAnonymously(auth))} className="flex items-center justify-center gap-3 bg-transparent border-2 border-gray-700 text-gray-300 py-3 rounded-2xl font-bold hover:bg-gray-800 transition-all">
            <User size={18} /> ゲストとして入室
          </button>
        </div>
      </div>
    );
  }

  // 3. ロビー画面（ルーム選択）
  if (!currentRoom) {
    return (
      <div className="flex flex-col h-screen bg-gray-50">
        <header className="bg-gray-900 text-white p-4 flex justify-between items-center shadow-md sticky top-0 z-10">
          <div className="flex items-center gap-2 font-black text-xl"><Hash className="text-green-400" /> ClassHub</div>
          <button onClick={() => signOut(auth)} className="text-gray-400 hover:text-red-400 transition-colors"><LogOut size={20}/></button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-xl font-bold text-gray-800">ルームを選択</h2>
            <button 
              onClick={() => setIsCreatingRoom(!isCreatingRoom)} 
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-md"
            >
              <Plus size={18} /> 新しいルーム
            </button>
          </div>

          {/* ルーム作成フォーム */}
          {isCreatingRoom && (
            <form onSubmit={handleCreateRoom} className="bg-white p-4 rounded-2xl shadow-lg border-2 border-indigo-100 mb-6 animate-in fade-in slide-in-from-top-4">
              <label className="block text-xs font-bold text-gray-500 mb-2">どんな話題で話しますか？</label>
              <div className="flex gap-2">
                <input 
                  autoFocus
                  value={newRoomTopic}
                  onChange={(e) => setNewRoomTopic(e.target.value)}
                  placeholder="例：数学の宿題、今度の打ち上げ..." 
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button type="submit" disabled={!newRoomTopic.trim()} className="bg-indigo-600 text-white px-4 rounded-xl font-bold disabled:bg-gray-300">作成</button>
              </div>
            </form>
          )}

          {/* ルームリスト */}
          <div className="grid gap-3">
            {rooms.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
                <p>まだルームがありません。<br/>右上のボタンから最初の話題を作ろう！</p>
              </div>
            ) : (
              rooms.map(room => (
                <div 
                  key={room.id} 
                  onClick={() => setCurrentRoom(room)}
                  className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all group relative"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg text-gray-800 mb-1 flex items-center gap-2">
                        <MessageSquare size={18} className="text-indigo-500" />
                        {room.topic}
                      </h3>
                      <p className="text-xs text-gray-500">作成者: {room.createdBy}</p>
                    </div>
                    <div className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                      入室する
                    </div>
                  </div>
                  {/* 作成者のみ削除可能 */}
                  {room.creatorId === user.uid && (
                    <button 
                      onClick={(e) => deleteRoom(e, room.id)}
                      className="absolute top-4 right-4 p-2 bg-white text-gray-300 hover:text-red-500 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all border border-gray-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    );
  }

  // 4. チャット画面（特定のルーム内）
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-indigo-600 text-white p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentRoom(null)} className="hover:bg-indigo-700 p-2 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="font-bold text-lg leading-tight">{currentRoom.topic}</h2>
            <span className="text-[10px] opacity-80 flex items-center gap-1">
              <Users size={10} /> ルームに参加中
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl mx-auto w-full bg-slate-50">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 items-start ${msg.userId === user.uid ? 'flex-row-reverse' : ''}`}>
            {msg.userPhoto ? (
              <img src={msg.userPhoto} className="w-8 h-8 rounded-full shadow-sm mt-1" alt="" />
            ) : (
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 mt-1"><User size={16}/></div>
            )}
            <div className={`flex flex-col max-w-[80%] ${msg.userId === user.uid ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] font-bold text-gray-400 mb-1 px-1">{msg.user}</span>
              <div className={`p-3 rounded-2xl shadow-sm border ${msg.userId === user.uid ? 'bg-indigo-600 text-white border-indigo-500 rounded-tr-none' : 'bg-white text-gray-800 border-gray-200 rounded-tl-none'}`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.userId === user.uid && (
                <button onClick={() => deleteMessage(msg.id)} className="text-gray-300 hover:text-red-400 mt-1 transition-colors">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <p>まだメッセージがありません。<br/>「こんにちは」と送ってみよう！</p>
          </div>
        )}
      </main>

      <form onSubmit={handleSendMessage} className="p-4 bg-white border-t flex gap-2 sticky bottom-0 z-20">
        <input 
          value={inputText} 
          onChange={e => setInputText(e.target.value)}
          placeholder="メッセージを入力..." 
          className="flex-1 bg-gray-100 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
        />
        <button type="submit" disabled={!inputText.trim()} className="bg-indigo-600 text-white p-3 rounded-2xl hover:bg-indigo-700 disabled:bg-gray-200 transition-all shadow-lg active:scale-95">
          <Send size={22} />
        </button>
      </form>
    </div>
  );
};

export default App;
