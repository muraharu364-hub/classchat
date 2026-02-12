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
  Hash, Send, LogOut, Github, Chrome, AlertCircle, 
  Trash2, Plus, MessageSquare, ArrowLeft, Users, Lock, 
  Sparkles, Heart, Bot, Info, Bell, Reply, X
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

// 🤖 AIからの話題リスト
const aiTopics = [
  "今日のお昼ご飯、何食べた？🍚",
  "最近ハマってるYouTubeチャンネルは？📺",
  "もし100万円もらえたら何に使う？💰",
  "今週末の予定は？📅",
  "おすすめのスマホアプリ教えて！📱",
  "最近あった面白いこと🤣",
  "好きな教科・苦手な教科は？📚",
  "最近聴いてる音楽は？🎵",
  "テスト勉強の進み具合どう？📝",
  "犬派？猫派？🐶🐱"
];

// 📢 アップデート履歴
const appUpdates = [
  { id: 1, date: "2/12", text: "メッセージに「返信」できるようになりました！💬" },
  { id: 2, date: "2/12", text: "最新のアップデート内容が見れるようになりました✨" },
  { id: 3, date: "2/11", text: "ルーム一覧で最新のメッセージがチラ見できるようになりました👀" }
];

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
  const [allMessages, setAllMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [newRoomTopic, setNewRoomTopic] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [error, setError] = useState(null);
  
  // 👇 返信先を記録するステートを追加
  const [replyingTo, setReplyingTo] = useState(null);
  
  const messagesEndRef = useRef(null);

  const currentMessages = allMessages
    .filter(msg => msg.roomId === currentRoom?.id)
    .sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages.length]);

  // ルームが変わったら返信状態をリセットする
  useEffect(() => {
    setReplyingTo(null);
  }, [currentRoom]);

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
        
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
        const topicIndex = (today.getFullYear() + today.getMonth() + today.getDate()) % aiTopics.length;
        const aiRoomId = `ai-room-${todayStr}`;

        if (!roomList.some(r => r.id === aiRoomId)) {
          roomList.push({
            id: aiRoomId,
            topic: `🤖 今日の話題: ${aiTopics[topicIndex]}`,
            createdBy: "AIアシスタント",
            creatorId: "ai-system",
            createdAt: { 
              toMillis: () => new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime(),
              toDate: () => new Date(today.getFullYear(), today.getMonth(), today.getDate())
            },
            isAi: true
          });
        }

        roomList.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setRooms(roomList);
      }, (err) => {
        if (err.code === 'permission-denied') setError("PERMISSION_DENIED");
      });
      return () => unsubscribe();
    } catch (e) { console.error(e); }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    try {
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'messages'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllMessages(msgs);
      }, (err) => console.error(err));
      return () => unsubscribe();
    } catch (e) { console.error(e); }
  }, [user]);

  const handleLogin = async (loginMethod) => {
    setError(null);
    try {
      await loginMethod();
    } catch (err) {
      if (err.code === 'auth/unauthorized-domain') {
        setError("URLの許可が必要です！Firebaseで設定してね。");
      } else {
        setError("ログインできませんでした😢 iPhoneの方は下の「ゲスト」で入ってみてね！");
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
      // 👇 送信するデータを作成
      const messageData = {
        roomId: currentRoom.id,
        userId: user.uid,
        user: user.displayName || `ゲスト`,
        userPhoto: user.photoURL,
        content: inputText,
        createdAt: serverTimestamp()
      };

      // 👇 もし返信中なら、返信先のデータも一緒に追加して送る
      if (replyingTo) {
        messageData.replyTo = {
          id: replyingTo.id,
          user: replyingTo.user,
          content: replyingTo.content
        };
      }

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), messageData);
      setInputText("");
      setReplyingTo(null); // 送信後は返信状態をリセット
    } catch (e) {
      setError("送信失敗... " + e.message);
    }
  };

  const deleteMessage = async (id) => {
    if(window.confirm("このメッセージを消しちゃう？")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'messages', id));
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

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 via-indigo-50 to-purple-100 p-6 font-sans">
        <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[3rem] shadow-[0_20px_60px_rgba(100,149,237,0.2)] w-full max-w-sm text-center border-4 border-white">
          <div className="bg-gradient-to-tr from-blue-400 to-indigo-400 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <Heart size={48} className="text-white fill-white animate-pulse" />
          </div>
          <h1 className="text-4xl font-black mb-2 text-gray-800 tracking-tight">ClassHub</h1>
          <p className="text-gray-500 mb-6 font-bold text-sm">クラスのみんなとつながろう✨</p>
          
          <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-6 rounded-r-xl text-left shadow-sm">
            <p className="text-xs text-blue-800 font-bold mb-1 flex items-center gap-1">
              <Info size={14}/> iPhone・LINEから開いた方へ
            </p>
            <p className="text-[10px] text-blue-700 leading-tight">
              セキュリティによりGoogleログインができない場合があります。その時は一番下の<span className="font-bold">「登録せずにのぞいてみる」</span>から参加してね！
            </p>
          </div>

          {error && <div className="mb-6 p-3 bg-red-100 text-red-500 text-xs rounded-xl font-bold">{error}</div>}

          <div className="flex flex-col gap-3">
            <button onClick={() => handleLogin(() => signInWithPopup(auth, new GoogleAuthProvider()))} className="group flex items-center justify-center gap-3 bg-white text-gray-700 py-3.5 rounded-2xl font-bold shadow-md hover:shadow-xl hover:-translate-y-1 transition-all border-2 border-transparent hover:border-blue-200">
              <Chrome size={20} className="text-blue-500" /> Googleで入る
            </button>
            <button onClick={() => handleLogin(() => signInWithPopup(auth, new GithubAuthProvider()))} className="group flex items-center justify-center gap-3 bg-gray-900 text-white py-3.5 rounded-2xl font-bold shadow-md hover:shadow-xl hover:-translate-y-1 transition-all">
              <Github size={20} /> GitHubで入る
            </button>
            
            <div className="mt-4 pt-4 border-t border-gray-100">
              <button onClick={() => handleLogin(() => signInAnonymously(auth))} className="w-full group flex items-center justify-center gap-2 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-600 py-3 rounded-2xl font-bold hover:shadow-md transition-all border border-blue-200">
                <Sparkles size={18} className="text-yellow-500 group-hover:animate-spin" /> 登録せずにのぞいてみる
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
          
          {/* 👇 アップデート情報のお知らせ枠を追加しました */}
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-4 rounded-3xl mb-8 border border-yellow-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-white/40 rounded-full blur-xl -mr-4 -mt-4"></div>
            <h3 className="text-sm font-black text-yellow-800 flex items-center gap-2 mb-3 relative z-10">
              <span className="bg-yellow-200 text-yellow-700 p-1.5 rounded-full"><Bell size={14} /></span>
              最新のアップデート
            </h3>
            <ul className="text-[11px] text-yellow-800/80 space-y-2 relative z-10 font-medium ml-1">
              {appUpdates.map(update => (
                <li key={update.id} className="flex gap-2.5 items-start">
                  <span className="font-bold opacity-60 shrink-0">{update.date}</span>
                  <span>{update.text}</span>
                </li>
              ))}
            </ul>
          </div>

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
            
            {rooms.map(room => {
              const roomRecentMsgs = allMessages
                .filter(msg => msg.roomId === room.id)
                .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
                .slice(0, 3)
                .reverse(); 

              return (
                <div 
                  key={room.id} 
                  onClick={() => setCurrentRoom(room)} 
                  className="group bg-white p-6 rounded-[2.5rem] shadow-sm border-2 border-transparent hover:border-blue-200 hover:shadow-xl cursor-pointer transition-all relative overflow-hidden flex flex-col justify-center"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-[4rem] -mr-8 -mt-8 group-hover:scale-110 transition-transform"></div>
                  
                  <h3 className="font-bold text-lg text-gray-800 flex items-center gap-3 relative z-10">
                    <span className={`p-3 rounded-full transition-colors ${room.isAi ? 'bg-purple-50 text-purple-500 group-hover:bg-purple-500 group-hover:text-white' : 'bg-blue-50 text-blue-500 group-hover:bg-blue-500 group-hover:text-white'}`}>
                      {room.isAi ? <Bot size={20} /> : <MessageSquare size={20} />}
                    </span>
                    <span className="truncate pr-8">{room.topic}</span>
                  </h3>
                  
                  <div className="mt-4 ml-14 bg-gray-50/80 rounded-2xl p-3 space-y-1.5 border border-gray-100 relative z-10">
                    {roomRecentMsgs.length > 0 ? (
                      roomRecentMsgs.map(msg => (
                        <div key={msg.id} className="text-[11px] flex gap-2 items-start">
                          <span className="font-bold text-gray-500 shrink-0">{msg.user}:</span>
                          <span className="text-gray-600 line-clamp-1 break-all">{msg.content}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-[11px] text-gray-400 italic">まだメッセージがありません✨</div>
                    )}
                  </div>
                  
                  <div className="ml-14 mt-3 flex flex-col gap-0.5 relative z-10">
                    <p className="text-xs text-gray-400 font-bold">Created by {room.createdBy}</p>
                    <p className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                      {room.createdAt?.toDate ? room.createdAt.toDate().toLocaleString('ja-JP', { 
                        year: 'numeric', month: 'short', day: 'numeric', 
                        hour: '2-digit', minute: '2-digit' 
                      }) : '作成中...'}
                    </p>
                  </div>
                  
                  {room.creatorId === user.uid && !room.isAi && (
                    <button 
                      onClick={async (e) => { e.stopPropagation(); if(window.confirm("本当に消しちゃう？")) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id)); }} 
                      className="absolute bottom-6 right-6 text-gray-300 hover:text-red-400 bg-white p-2 rounded-full hover:bg-red-50 transition-all shadow-sm z-20"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#F0F4F8] font-sans">
      <header className="bg-white/80 backdrop-blur-md p-4 px-6 flex justify-between items-center shadow-sm sticky top-0 z-10 border-b border-white">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentRoom(null)} className="hover:bg-blue-50 text-blue-500 p-3 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="font-bold text-lg text-gray-800 leading-none truncate">{currentRoom.topic}</h2>
            <span className="text-[10px] text-blue-400 font-bold flex items-center gap-1 mt-1">
              <Users size={12} /> 会話中
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-0.5 max-w-3xl mx-auto w-full">
        {currentMessages.map((msg, index) => {
          const isMe = msg.userId === user.uid;
          
          return (
            <div key={msg.id} className="flex gap-2 group items-start">
              {msg.userPhoto ? (
                <img src={msg.userPhoto} className="w-8 h-8 rounded-full shadow-md border-2 border-white shrink-0" alt="" />
              ) : (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md border-2 border-white font-bold text-xs shrink-0 ${isMe ? 'bg-indigo-300' : 'bg-blue-300'}`}>
                  {msg.user.slice(0,1)}
                </div>
              )}
              
              <div className="flex flex-col max-w-[85%] min-w-0">
                <span className="text-[10px] font-bold text-gray-400 mb-0.5 ml-1 flex items-baseline gap-2">
                  <span className="truncate">{msg.user} {isMe && <span className="bg-blue-100 text-blue-600 px-1.5 rounded-md ml-1">自分</span>}</span>
                  <span className="text-[9px] font-normal text-gray-400 shrink-0">
                    {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </span>
                
                <div className={`
                  px-4 py-3 rounded-[1.5rem] shadow-sm text-sm font-medium leading-relaxed relative break-words flex flex-col
                  ${isMe 
                    ? 'bg-white border-2 border-blue-100 text-gray-800 rounded-tl-none' 
                    : 'bg-white text-gray-700 rounded-tl-none border-2 border-transparent'}
                `}>
                  {/* 👇 もし返信データがあったら、引用を表示する */}
                  {msg.replyTo && (
                    <div className={`mb-2 text-[10px] p-2 rounded-xl line-clamp-2 ${isMe ? 'bg-blue-50/50 text-blue-600/80 border-l-2 border-blue-400' : 'bg-gray-50 text-gray-500 border-l-2 border-gray-300'}`}>
                      <span className="font-bold">{msg.replyTo.user}</span>: {msg.replyTo.content}
                    </div>
                  )}
                  {msg.content}
                </div>
                
                {/* 👇 返信ボタンと削除ボタン */}
                <div className="flex gap-3 mt-1 ml-2 opacity-0 group-hover:opacity-100 transition-all self-start">
                  <button onClick={() => setReplyingTo(msg)} className="text-[10px] text-gray-400 hover:text-blue-500 flex items-center gap-1 bg-white px-2 py-0.5 rounded-md shadow-sm border border-gray-100">
                    <Reply size={10}/> 返信
                  </button>
                  {isMe && (
                    <button onClick={() => deleteMessage(msg.id)} className="text-[10px] text-gray-300 hover:text-red-400 flex items-center gap-1 bg-white px-2 py-0.5 rounded-md shadow-sm border border-gray-100">
                      <Trash2 size={10}/> 削除
                    </button>
                  )}
                </div>

              </div>
            </div>
          );
        })}
        
        {currentMessages.length === 0 && (
          <div className="text-center py-20">
            <div className="bg-white p-6 rounded-full mb-4 inline-block shadow-sm">
              <Sparkles size={32} className="text-yellow-400" />
            </div>
            <p className="text-gray-400 font-bold text-sm">一番乗りで話しかけてみよう！✨</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* 👇 入力フォームのエリアをグループ化 */}
      <div className="bg-white border-t border-blue-50 flex flex-col sticky bottom-0 z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.02)]">
        
        {/* 👇 返信先が選ばれている時の表示（UI） */}
        {replyingTo && (
          <div className="px-4 py-2 bg-blue-50/80 flex items-center justify-between text-xs border-b border-blue-100">
            <div className="flex items-center gap-2 text-blue-700 overflow-hidden">
              <Reply size={12} className="shrink-0" />
              <span className="font-bold shrink-0">{replyingTo.user} に返信 :</span>
              <span className="truncate opacity-80">{replyingTo.content}</span>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-blue-200 rounded-full text-blue-500 transition-colors">
              <X size={14} />
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="p-4 flex gap-2">
          <input 
            value={inputText} 
            onChange={e => setInputText(e.target.value)}
            placeholder={replyingTo ? "返信を入力..." : "メッセージを入力..."} 
            className="flex-1 bg-gray-50 rounded-[2rem] px-6 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all border border-gray-100 font-medium"
          />
          <button type="submit" disabled={!inputText.trim()} className="bg-blue-500 text-white p-3 rounded-full hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:scale-100 disabled:shadow-none transition-all active:scale-95">
            <Send size={20} className="ml-0.5" />
          </button>
        </form>

      </div>
    </div>
  );
};

export default App;
