
import { useEffect, useState } from "react";
import {
  ShieldCheck, Store, Headset, Truck, Wallet, Package,
  LogIn, LogOut, ArrowLeft, Sparkles, Plus, Pencil,
  RefreshCw, Eye, EyeOff
} from "lucide-react";
import { supabase, supabaseReady } from "../supabase.js";

const countries = [
  { value: "SY", label: "سوريا" },
  { value: "IQ", label: "العراق" },
  { value: "IR", label: "إيران" }
];

const emptyProduct = {
  name: "",
  description: "",
  price_usd: "",
  image_url: "",
  category: "",
  is_active: true
};

export default function App() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("SY");
  const [session, setSession] = useState(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [savingProduct, setSavingProduct] = useState(false);

  useEffect(() => {
    if (!supabaseReady || !supabase) {
      setCheckingSession(false);
      return;
    }

    let active = true;

    async function loadSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (active) setSession(data?.session ?? null);
      } catch {
        if (active) setNotice("تعذر التحقق من جلسة الدخول.");
      } finally {
        if (active) setCheckingSession(false);
      }
    }

    loadSession();

    const { data } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (active) setSession(nextSession);
      }
    );

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function checkAdmin() {
      setIsAdmin(false);
      setAdminOpen(false);

      if (!session || !supabase) return;

      setCheckingAdmin(true);

      try {
        const { data, error } = await supabase.rpc("is_nexora_admin");
        if (error) throw error;
        if (active) setIsAdmin(data === true);
      } catch {
        if (active) {
          setIsAdmin(false);
          setNotice(
            "تعذر التحقق من صلاحيات الإدارة. تأكد من إعداد قاعدة البيانات."
          );
        }
      } finally {
        if (active) setCheckingAdmin(false);
      }
    }

    checkAdmin();

    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    loadProducts();
  }, [session]);

  async function loadProducts() {
    if (!supabaseReady || !supabase) return;

    setLoadingProducts(true);

    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, price_usd, image_url, category, is_active")
        .order("name", { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      setNotice("تعذر تحميل المنتجات: " + (error.message || "خطأ غير معروف"));
    } finally {
      setLoadingProducts(false);
    }
  }

  async function submitAuth(event) {
    event.preventDefault();
    setNotice("");

    if (!supabaseReady || !supabase) {
      setNotice("تحقق من إعدادات ربط Supabase.");
      return;
    }

    if (password.length < 8) {
      setNotice("يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.");
      return;
    }

    setBusy(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { country } }
        });

        if (error) throw error;

        setNotice(
          data.session
            ? "تم إنشاء الحساب بنجاح."
            : "تفقد بريدك الإلكتروني لتأكيد الحساب."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });

        if (error) throw error;
        setNotice("تم تسجيل الدخول بنجاح.");
      }
    } catch (error) {
      setNotice(error?.message || "تعذر إكمال العملية.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;

    setBusy(true);
    setNotice("");

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setSession(null);
      setIsAdmin(false);
      setNotice("تم تسجيل الخروج.");
    } catch (error) {
      setNotice(error?.message || "تعذر تسجيل الخروج.");
    } finally {
      setBusy(false);
    }
  }

  function startNewProduct() {
    setEditingId(null);
    setProductForm({ ...emptyProduct });
    setNotice("");
    setAdminOpen(true);
  }

  function startEditProduct(product) {
    setEditingId(product.id);
    setProductForm({
      name: product.name || "",
      description: product.description || "",
      price_usd: String(product.price_usd ?? ""),
      image_url: product.image_url || "",
      category: product.category || "",
      is_active: product.is_active !== false
    });
    setNotice("");
    setAdminOpen(true);
  }

  async function saveProduct(event) {
    event.preventDefault();
    setNotice("");

    if (!session || !isAdmin) {
      setNotice("لا تملك صلاحية إدارة المنتجات.");
      return;
    }

    const price = Number(productForm.price_usd);

    if (!productForm.name.trim()) {
      setNotice("اكتب اسم المنتج.");
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      setNotice("أدخل سعرًا صحيحًا بالدولار.");
      return;
    }

    if (productForm.image_url.trim()) {
      try {
        const parsed = new URL(productForm.image_url.trim());
        if (parsed.protocol !== "https:") {
          setNotice("رابط الصورة يجب أن يبدأ بـ https://");
          return;
        }
      } catch {
        setNotice("رابط الصورة غير صالح.");
        return;
      }
    }

    setSavingProduct(true);

    try {
      const payload = {
        name: productForm.name.trim(),
        description: productForm.description.trim(),
        price_usd: price,
        image_url: productForm.image_url.trim() || null,
        category: productForm.category.trim() || null,
        is_active: Boolean(productForm.is_active)
      };

      let result;

      if (editingId) {
        result = await supabase
          .from("products")
          .update(payload)
          .eq("id", editingId)
          .select("id")
          .single();
      } else {
        result = await supabase
          .from("products")
          .insert(payload)
          .select("id")
          .single();
      }

      if (result.error) throw result.error;

      setNotice(editingId ? "تم تعديل المنتج." : "تمت إضافة المنتج.");
      setAdminOpen(false);
      setEditingId(null);
      setProductForm({ ...emptyProduct });
      await loadProducts();
    } catch (error) {
      setNotice(
        "لم يتم حفظ المنتج. قد يكون هناك حقل مطلوب أو صلاحية ناقصة. التفاصيل: " +
        (error?.message || "خطأ غير معروف")
      );
    } finally {
      setSavingProduct(false);
    }
  }

  async function toggleProduct(product) {
    if (!isAdmin) return;

    setNotice("");

    try {
      const { error } = await supabase
        .from("products")
        .update({ is_active: !product.is_active })
        .eq("id", product.id);

      if (error) throw error;

      setNotice(
        product.is_active
          ? "تم إيقاف عرض المنتج."
          : "تم تفعيل عرض المنتج."
      );

      await loadProducts();
    } catch (error) {
      setNotice("تعذر تغيير حالة المنتج: " + (error.message || ""));
    }
  }

  const shownProducts = isAdmin
    ? products
    : products.filter((product) => product.is_active);

  return (
    <main className="page" dir="rtl">
      <nav className="nav">
        <a className="brand" href="#" aria-label="NEXORA الصفحة الرئيسية">
          <span className="brand-mark">N</span>
          <span>
            NEXORA
            <small>SMART SHOPPING</small>
          </span>
        </a>

        <span className="currency">USD <span>●</span></span>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={15} />
            متجر ذكي • منصة بائعين
          </div>

          <h1>تجارتك، <em>بمستوى جديد.</em></h1>

          <p>
            اكتشف المنتجات، وتابع طلباتك، واستمتع بتجربة تسوق
            واضحة وآمنة.
          </p>

          <div className="country-line">
            {countries.map((item) => (
              <span key={item.value}>{item.label}</span>
            ))}
          </div>

          <div className="hero-points">
            <span><ShieldCheck size={17} /> حماية الحسابات</span>
            <span><Truck size={17} /> إدارة التوصيل</span>
            <span><Headset size={17} /> فريق دعم</span>
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="orb orb-one" />
          <div className="orb orb-two" />
          <div className="product-stage">
            <div className="stage-glow" />
            <div className="cube">
              <Package size={68} strokeWidth={1.1} />
            </div>
            <div className="stage-label">
              NEXORA
              <small>SMART STORE</small>
            </div>
          </div>
          <div className="floating-card">
            <ShieldCheck size={18} />
            <span>تجربة تسوق آمنة</span>
          </div>
        </div>
      </section>

      <section className="content-grid">
        <div className="features">
          <article className="feature-card">
            <span className="feature-icon"><Store /></span>
            <h3>متجر ومنتجات</h3>
            <p>عرض المنتجات والأسعار المتاحة.</p>
          </article>

          <article className="feature-card">
            <span className="feature-icon"><Wallet /></span>
            <h3>حسابات المستخدمين</h3>
            <p>نسعى لتوفير إدارة واضحة وآمنة.</p>
          </article>

          <article className="feature-card">
            <span className="feature-icon"><Headset /></span>
            <h3>دعم ومتابعة</h3>
            <p>متابعة الخدمات والطلبات عند تفعيلها.</p>
          </article>
        </div>

        <section className="auth-card">
          <div className="auth-heading">
            <div className="auth-symbol">
              {isAdmin ? <ShieldCheck /> : <LogIn />}
            </div>
            <div>
              <h2>
                {session
                  ? isAdmin ? "لوحة حساب المدير" : "أهلاً بك في NEXORA"
                  : mode === "login" ? "تسجيل الدخول" : "إنشاء حساب عميل"}
              </h2>
              <p>
                {session
                  ? session.user.email
                  : "أدخل بياناتك للمتابعة بأمان."}
              </p>
            </div>
          </div>

          {checkingSession ? (
            <p className="notice">جارٍ التحقق من جلسة الدخول...</p>
          ) : session ? (
            <div className="signed-in">
              <div className="success-mark"><ShieldCheck /></div>
              <strong>تم تسجيل الدخول</strong>
              <p>{session.user.email}</p>

              {checkingAdmin ? (
                <p className="notice">جارٍ التحقق من صلاحيات الإدارة...</p>
              ) : isAdmin ? (
                <button
                  className="primary-btn"
                  onClick={() => {
                    setAdminOpen(!adminOpen);
                    setNotice("");
                  }}
                >
                  <Store size={17} />
                  {adminOpen ? "إغلاق لوحة الإدارة" : "فتح لوحة الإدارة"}
                </button>
              ) : (
                <p className="small-note">
                  حسابك مسجل كمستخدم عادي، ولا يملك صلاحيات الإدارة.
                </p>
              )}

              <button
                className="text-btn"
                onClick={loadProducts}
                disabled={loadingProducts}
              >
                <RefreshCw size={16} />
                تحديث المنتجات
              </button>

              <button
                className="primary-btn"
                onClick={signOut}
                disabled={busy}
              >
                <LogOut size={17} />
                {busy ? "يرجى الانتظار..." : "تسجيل الخروج"}
              </button>
            </div>
          ) : (
            <form onSubmit={submitAuth}>
              <label htmlFor="email">البريد الإلكتروني</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />

              <label htmlFor="password">كلمة المرور</label>
              <input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="8 أحرف على الأقل"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />

              {mode === "signup" && (
                <>
                  <label htmlFor="country">بلد الحساب</label>
                  <select
                    id="country"
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                  >
                    {countries.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <button className="primary-btn" type="submit" disabled={busy}>
                {busy
                  ? "يرجى الانتظار..."
                  : mode === "login" ? "دخول آمن" : "إنشاء الحساب"}
                <ArrowLeft size={17} />
              </button>

              <button
                className="text-btn"
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setNotice("");
                }}
              >
                {mode === "login"
                  ? "إنشاء حساب عميل جديد"
                  : "لدي حساب بالفعل — تسجيل الدخول"}
              </button>
            </form>
          )}

          {notice && <p className="notice" role="status">{notice}</p>}

          <div className="auth-foot">
            <ShieldCheck size={15} />
            لا تشارك كلمة المرور أو رموز التحقق مع أي شخص.
          </div>
        </section>
      </section>

      {session && isAdmin && adminOpen && (
        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <h2 style={{ margin: 0 }}>إدارة المنتجات</h2>
              <p style={{ opacity: 0.75 }}>إضافة المنتجات وتعديل الأسعار وحالة العرض.</p>
            </div>
            <button style={actionStyle} onClick={startNewProduct}>
              <Plus size={17} /> منتج جديد
            </button>
          </div>

          {editingId && (
            <p className="notice">أنت تعدّل منتجًا موجودًا.</p>
          )}

          <form onSubmit={saveProduct} style={formGridStyle}>
            <label style={fieldStyle}>
              اسم المنتج *
              <input
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                required
                maxLength={150}
                placeholder="اسم المنتج"
              />
            </label>

            <label style={fieldStyle}>
              السعر بالدولار *
              <input
                type="number"
                min="0"
                step="0.01"
                value={productForm.price_usd}
                onChange={(e) => setProductForm({ ...productForm, price_usd: e.target.value })}
                required
                placeholder="0.00"
              />
            </label>

            <label style={fieldStyle}>
              التصنيف
              <input
                value={productForm.category}
                onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                placeholder="مثلاً: إلكترونيات"
              />
            </label>

            <label style={fieldStyle}>
              رابط صورة المنتج HTTPS
              <input
                type="url"
                value={productForm.image_url}
                onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
                placeholder="https://..."
              />
            </label>

            <label style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
              وصف المنتج
              <textarea
                rows={3}
                value={productForm.description}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                placeholder="تفاصيل المنتج..."
              />
            </label>

            <label style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
              <input
                type="checkbox"
                checked={productForm.is_active}
                onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })}
              />
              إظهار المنتج في المتجر
            </label>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button style={actionStyle} type="submit" disabled={savingProduct}>
                {savingProduct ? "جارٍ الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة المنتج"}
              </button>
              <button
                style={secondaryStyle}
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setProductForm({ ...emptyProduct });
                  setNotice("");
                }}
              >
                تفريغ النموذج
              </button>
            </div>
          </form>

          <div style={productsGridStyle}>
            {products.map((product) => (
              <article key={product.id} style={productCardStyle}>
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    style={productImageStyle}
                    loading="lazy"
                  />
                ) : (
                  <div style={imagePlaceholderStyle}><Package size={35} /></div>
                )}

                <h3>{product.name}</h3>
                <p>{product.description || "لا يوجد وصف."}</p>
                <strong>${Number(product.price_usd || 0).toFixed(2)}</strong>
                <p>الحالة: {product.is_active ? "ظاهر" : "متوقف"}</p>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={secondaryStyle} onClick={() => startEditProduct(product)}>
                    <Pencil size={15} /> تعديل
                  </button>
                  <button style={secondaryStyle} onClick={() => toggleProduct(product)}>
                    {product.is_active ? <EyeOff size={15} /> : <Eye size={15} />}
                    {product.is_active ? "إيقاف" : "تفعيل"}
                  </button>
                </div>
              </article>
            ))}
          </div>

          {loadingProducts && <p className="notice">جارٍ تحميل المنتجات...</p>}
          {!loadingProducts && products.length === 0 && (
            <p className="notice">لا توجد منتجات بعد. أضف أول منتج من النموذج أعلاه.</p>
          )}
        </section>
      )}

      <section style={storeSectionStyle}>
        <h2>منتجات NEXORA</h2>
        {loadingProducts ? (
          <p>جارٍ تحميل المنتجات...</p>
        ) : shownProducts.length === 0 ? (
          <p>لا توجد منتجات معروضة حاليًا.</p>
        ) : (
          <div style={productsGridStyle}>
            {shownProducts.map((product) => (
              <article key={product.id} style={productCardStyle}>
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} style={productImageStyle} loading="lazy" />
                ) : (
                  <div style={imagePlaceholderStyle}><Package size={35} /></div>
                )}
                <h3>{product.name}</h3>
                <p>{product.description || "تواصل مع الدعم لمزيد من التفاصيل."}</p>
                <strong>${Number(product.price_usd || 0).toFixed(2)}</strong>
                {product.category && <small>{product.category}</small>}
              </article>
            ))}
          </div>
        )}
      </section>

      <footer>
        <span>© {new Date().getFullYear()} NEXORA</span>
        <span>تجارة أذكى. إدارة أوضح.</span>
      </footer>
    </main>
  );
}

const panelStyle = {
  maxWidth: 1100, margin: "24px auto", padding: 20,
  borderRadius: 18, border: "1px solid #26364d",
  background: "#101a2b", color: "#f5f7fb"
};
const panelHeaderStyle = {
  display: "flex", justifyContent: "space-between",
  alignItems: "center", gap: 14, flexWrap: "wrap"
};
const formGridStyle = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14, marginTop: 20, marginBottom: 26
};
const fieldStyle = {
  display: "flex", flexDirection: "column", gap: 7, minWidth: 0
};
const actionStyle = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  gap: 8, padding: "11px 16px", borderRadius: 10, border: 0,
  background: "#d8b46a", color: "#111827", fontWeight: 700,
  cursor: "pointer"
};
const secondaryStyle = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  gap: 7, padding: "9px 12px", borderRadius: 9,
  border: "1px solid #41516a", background: "#172438",
  color: "#f5f7fb", cursor: "pointer"
};
const productsGridStyle = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 16, marginTop: 18
};
const productCardStyle = {
  padding: 14, borderRadius: 14, border: "1px solid #2b3a50",
  background: "#0b1322", color: "#f5f7fb", minWidth: 0
};
const productImageStyle = {
  width: "100%", height: 170, objectFit: "cover", borderRadius: 10
};
const imagePlaceholderStyle = {
  height: 170, borderRadius: 10, display: "flex",
  alignItems: "center", justifyContent: "center",
  background: "#172438", color: "#d8b46a"
};
const storeSectionStyle = {
  maxWidth: 1100, margin: "24px auto", padding: 20
};
