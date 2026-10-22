import { useEffect, useState } from "react";
import { ShieldCheck, Store, Headset, Truck, Wallet, Package, LogIn, LogOut, ArrowLeft, Sparkles } from "lucide-react";
import { supabase, supabaseReady } from "./supabase.js";

const countries = [
  { value: "SY", label: "سوريا" },
  { value: "IQ", label: "العراق" },
  { value: "IR", label: "إيران" }
];

export default function App() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("SY");
  const [session, setSession] = useState(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabaseReady) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  async function submitAuth(event) {
    event.preventDefault();
    setNotice("");
    if (!supabaseReady) {
      setNotice("أضف إعدادات Supabase إلى متغيرات البيئة أولاً.");
      return;
    }
    if (!email.trim() || !password) {
      setNotice("اكتب البريد الإلكتروني وكلمة المرور.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { country } }
        });
        if (error) throw error;
        setNotice("تم إرسال طلب التسجيل. تحقق من بريدك الإلكتروني لتأكيد الحساب.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setNotice("تم تسجيل الدخول.");
      }
    } catch (error) {
      setNotice(error.message || "تعذر إكمال العملية.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setNotice("تم تسجيل الخروج.");
  }

  return (
    <main className="page">
      <nav className="nav">
        <a className="brand" href="#" aria-label="NEXORA الصفحة الرئيسية">
          <span className="brand-mark">N</span>
          <span>NEXORA<small>SMART SHOPPING</small></span>
        </a>
        <span className="currency">USD <span>●</span></span>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={15}/> متجر ذكي • منصة بائعين</div>
          <h1>تجارتك، <em>بمستوى جديد.</em></h1>
          <p>متجر أنيق للمنتجات الأصلية، مع حسابات مستقلة للبائعين، وطلبات واضحة، وإدارة آمنة.</p>
          <div className="country-line">
            {countries.map(item => <span key={item.value}>{item.label}</span>)}
          </div>
          <div className="hero-points">
            <span><ShieldCheck size={17}/> حماية الحسابات</span>
            <span><Truck size={17}/> إدارة التوصيل</span>
            <span><Headset size={17}/> فريق دعم</span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orb orb-one"></div><div className="orb orb-two"></div>
          <div className="product-stage">
            <div className="stage-glow"></div>
            <div className="cube"><Package size={68} strokeWidth={1.1}/></div>
            <div className="stage-label">NEXORA <small>SMART STORE</small></div>
          </div>
          <div className="floating-card"><ShieldCheck size={18}/><span>تجربة تسوق آمنة</span></div>
        </div>
      </section>

      <section className="content-grid">
        <div className="features">
          <article className="feature-card"><span className="feature-icon"><Store/></span><h3>متجر ومنتجات</h3><p>عرض المنتجات والأسعار وإدارة المخزون.</p></article>
          <article className="feature-card"><span className="feature-icon"><Wallet/></span><h3>محافظ مستقلة</h3><p>سجل مالي منفصل لكل مستخدم، بالدولار.</p></article>
          <article className="feature-card"><span className="feature-icon"><Headset/></span><h3>دعم ومتابعة</h3><p>متابعة الطلبات والتواصل مع فريق الدعم.</p></article>
        </div>

        <section className="auth-card">
          <div className="auth-heading">
            <div className="auth-symbol"><LogIn/></div>
            <div><h2>{session ? "أهلاً بك في NEXORA" : mode === "login" ? "تسجيل الدخول" : "إنشاء حساب عميل"}</h2>
              <p>{session ? "تم تسجيل دخولك بنجاح." : "أدخل بياناتك للمتابعة بأمان."}</p></div>
          </div>

          {session ? (
            <div className="signed-in">
              <div className="success-mark"><ShieldCheck/></div>
              <strong>أنت مسجل الدخول</strong>
              <p>{session.user.email}</p>
              <button className="primary-btn" onClick={signOut}><LogOut size={17}/> تسجيل الخروج</button>
              <p className="small-note">سيتم توصيل لوحة البائع والإدارة بعد إعداد الأدوار والصلاحيات في قاعدة البيانات.</p>
            </div>
          ) : (
            <form onSubmit={submitAuth}>
              <label htmlFor="email">البريد الإلكتروني</label>
              <input id="email" type="email" autoComplete="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} required/>
              <label htmlFor="password">كلمة المرور</label>
              <input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="أدخل كلمة المرور" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required/>
              {mode === "signup" && <>
                <label htmlFor="country">بلد الحساب</label>
                <select id="country" value={country} onChange={e => setCountry(e.target.value)}>
                  {countries.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </>}
              <button className="primary-btn" type="submit" disabled={busy}>
                {busy ? "يرجى الانتظار..." : mode === "login" ? "دخول آمن" : "إنشاء الحساب"}
                <ArrowLeft size={17}/>
              </button>
              <button className="text-btn" type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setNotice(""); }}>
                {mode === "login" ? "إنشاء حساب عميل جديد" : "لدي حساب بالفعل — تسجيل الدخول"}
              </button>
              {notice && <p className="notice" role="status">{notice}</p>}
              {!supabaseReady && <p className="notice warning">واجهة تجريبية: اربط Supabase قبل استخدام تسجيل الدخول الفعلي.</p>}
            </form>
          )}
          <div className="auth-foot"><ShieldCheck size={15}/> لا تشارك كلمة المرور أو رموز التحقق مع أي شخص.</div>
        </section>
      </section>

      <footer><span>© {new Date().getFullYear()} NEXORA</span><span>تجارة أذكى. إدارة أوضح.</span></footer>
    </main>
  );
}