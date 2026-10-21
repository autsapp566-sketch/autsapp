import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  createKnowledgeItem,
  deleteKnowledgeItem,
  fetchKnowledge,
  generateKnowledgeCopilot,
  updateKnowledgeItem,
  uploadProductImages,
  analyzeProductImages,
} from '../../api/client.js';
import ColorSquarePicker from '../../components/ColorSquarePicker.jsx';
import { hexToArabicName, swatchForColor } from '../../lib/colorNames.js';

const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const EU_CLOTHING_SIZES = ['36', '38', '40', '42', '44', '46'];
const COLOR_PRESETS = ['أبيض', 'أسود', 'أحمر', 'أزرق', 'أخضر', 'بيج', 'رمادي', 'زيتي', 'وردي', 'برتقالي'];

const TABS = [
  { id: 'all', label: 'الكل' },
  { id: 'product', label: 'المنتجات والخدمات' },
  { id: 'faq', label: 'الأسئلة الشائعة' },
];

function TrashIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function CardActions({ onEdit, onDelete }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300"
      >
        <EditIcon />
        تعديل
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300"
      >
        <TrashIcon />
        حذف
      </button>
    </div>
  );
}

function ProductPlaceholder() {
  return (
    <div className="flex h-40 items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-4xl">
      📦
    </div>
  );
}

function FaqCard({ item, onEdit, onDelete, canEdit }) {
  return (
    <article className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
      <span className="mb-3 inline-flex w-fit rounded-lg bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-300">
        سؤال شائع FAQ
      </span>
      <h3 className="text-base font-bold leading-snug text-white">{item.title}</h3>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-400">{item.answer || item.description}</p>
      {canEdit ? (
        <CardActions onEdit={() => onEdit(item)} onDelete={() => onDelete(item.id)} />
      ) : null}
    </article>
  );
}

function MetaChips({ items, tone = 'slate' }) {
  if (!items?.length) return null;
  const toneClass =
    tone === 'violet'
      ? 'bg-violet-500/15 text-violet-200'
      : tone === 'amber'
        ? 'bg-amber-500/15 text-amber-200'
        : 'bg-slate-700/80 text-slate-300';
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((label) => (
        <span key={label} className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${toneClass}`}>
          {label}
        </span>
      ))}
    </div>
  );
}

function ProductCard({ item, onEdit, onDelete, canEdit }) {
  const cover = item.imageUrls?.[0] || item.imageUrl;
  const extraImages = (item.imageUrls?.length ?? 0) > 1 ? item.imageUrls.length - 1 : 0;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-lg">
      <div className="relative">
        {cover ? <img src={cover} alt="" className="h-40 w-full object-cover" /> : <ProductPlaceholder />}
        {extraImages > 0 ? (
          <span className="absolute bottom-2 left-2 rounded-lg bg-black/70 px-2 py-0.5 text-[10px] text-white">
            +{extraImages} صور
          </span>
        ) : null}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {item.priceDh != null ? (
            <span className="text-lg font-bold text-emerald-400">{item.priceDh} DH</span>
          ) : (
            <span />
          )}
          <span className="rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
            منتج / خدمة
          </span>
        </div>
        <h3 className="font-bold text-white">{item.title}</h3>
        <p className="text-sm text-slate-400">{item.description}</p>
        <MetaChips items={item.colors} tone="violet" />
        <MetaChips items={item.sizes} tone="amber" />
        {canEdit ? (
          <CardActions onEdit={() => onEdit(item)} onDelete={() => onDelete(item.id)} />
        ) : null}
      </div>
    </article>
  );
}

function ProductMediaFields({
  form,
  setForm,
  uploading,
  onUpload,
  analyzing,
  onAnalyze,
  swatches,
  onSwatch,
  imageLink,
  setImageLink,
  colorDraft,
  setColorDraft,
}) {
  const [pickerHex, setPickerHex] = useState('#7c3aed');
  const imageUrls = form.imageUrls ?? [];

  function toggleSize(size) {
    setForm((p) => {
      const set = new Set(p.sizes ?? []);
      if (set.has(size)) set.delete(size);
      else set.add(size);
      return { ...p, sizes: [...set] };
    });
  }

  function toggleColor(color) {
    setForm((p) => {
      const set = new Set(p.colors ?? []);
      if (set.has(color)) set.delete(color);
      else set.add(color);
      return { ...p, colors: [...set] };
    });
  }

  function addImageLink() {
    const url = imageLink.trim();
    if (!url) return;
    setForm((p) => ({ ...p, imageUrls: [...new Set([...(p.imageUrls ?? []), url])] }));
    setImageLink('');
  }

  function removeImage(url) {
    setForm((p) => ({ ...p, imageUrls: (p.imageUrls ?? []).filter((u) => u !== url) }));
  }

  function addCustomColor() {
    const c = colorDraft.trim();
    if (!c) return;
    toggleColor(c);
    setColorDraft('');
  }

  function addPickedColor() {
    const name = hexToArabicName(pickerHex);
    if (!name) return;
    onSwatch(name, pickerHex);
    setForm((p) => ((p.colors ?? []).includes(name) ? p : { ...p, colors: [...(p.colors ?? []), name] }));
  }

  return (
    <div className="space-y-5 border-t border-slate-800 pt-4">
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-200">صور المنتج (متعددة)</p>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 px-4 py-6 text-center hover:bg-emerald-500/10">
          <span className="text-sm font-medium text-emerald-300">
            {uploading ? 'جاري الرفع…' : '📷 رفع صور من الجهاز (يمكن اختيار أكثر من صورة)'}
          </span>
          <span className="mt-1 text-xs text-slate-500">PNG, JPG — حتى 5MB لكل صورة</span>
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={uploading}
            onChange={onUpload}
            className="sr-only"
          />
        </label>
        <div className="flex gap-2">
          <input
            dir="ltr"
            value={imageLink}
            onChange={(e) => setImageLink(e.target.value)}
            placeholder="https://... رابط صورة إضافي"
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            onClick={addImageLink}
            className="shrink-0 rounded-xl border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
          >
            إضافة رابط
          </button>
        </div>
        {imageUrls.length ? (
          <button
            type="button"
            onClick={() => onAnalyze(imageUrls)}
            disabled={analyzing || uploading}
            className="w-full rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {analyzing ? 'جاري تحليل الصور…' : '✨ تحليل الصور بالذكاء الاصطناعي (العنوان والوصف والألوان)'}
          </button>
        ) : null}
        {imageUrls.length ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {imageUrls.map((url) => (
              <div key={url} className="group relative overflow-hidden rounded-lg border border-slate-700">
                <img src={url} alt="" className="h-20 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(url)}
                  className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-white opacity-0 transition group-hover:opacity-100"
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-200">ألوان المنتج</p>
        <div className="flex flex-wrap gap-2">
          {[...COLOR_PRESETS, ...(form.colors ?? []).filter((c) => !COLOR_PRESETS.includes(c))].map((c) => {
            const active = (form.colors ?? []).includes(c);
            const swatch = swatchForColor(c, swatches);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleColor(c)}
                className={[
                  'flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition',
                  active ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700',
                ].join(' ')}
              >
                {swatch ? (
                  <span
                    className="inline-block h-3 w-3 rounded-full border border-white/30"
                    style={{ backgroundColor: swatch }}
                  />
                ) : null}
                {c}
              </button>
            );
          })}
        </div>
        <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950 p-3">
          <ColorSquarePicker value={pickerHex} onChange={setPickerHex} />
          <div className="flex items-center gap-2">
            <span
              className="h-9 w-9 shrink-0 rounded-lg border border-slate-600"
              style={{ backgroundColor: pickerHex }}
            />
            <span className="min-w-0 flex-1 truncate text-xs text-slate-300">
              🎨 {hexToArabicName(pickerHex)}
              <span dir="ltr" className="mr-2 text-slate-500">
                {pickerHex}
              </span>
            </span>
            <button
              type="button"
              onClick={addPickedColor}
              className="shrink-0 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500"
            >
              إضافة اللون
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            value={colorDraft}
            onChange={(e) => setColorDraft(e.target.value)}
            placeholder="لون مخصص…"
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            onClick={addCustomColor}
            className="shrink-0 rounded-xl border border-slate-600 px-3 py-2 text-xs text-slate-200"
          >
            إضافة
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-200">مقاسات الملابس</p>
        <p className="text-xs text-slate-500">مقاسات حروف (S/M/L) ومقاسات أوروبية للملابس</p>
        <div className="flex flex-wrap gap-2">
          {[...CLOTHING_SIZES, ...EU_CLOTHING_SIZES].map((size) => {
            const active = (form.sizes ?? []).includes(size);
            return (
              <button
                key={size}
                type="button"
                onClick={() => toggleSize(size)}
                className={[
                  'min-w-[2.5rem] rounded-lg px-2 py-1.5 text-xs font-semibold transition',
                  active ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700',
                ].join(' ')}
              >
                {size}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal>
      <div
        className={[
          'max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl',
          wide ? 'max-w-2xl' : 'max-w-lg',
        ].join(' ')}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function KnowledgePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [tab, setTab] = useState('all');
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ all: 0, product: 0, faq: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [copilotBrief, setCopilotBrief] = useState('');
  const [uploadingImages, setUploadingImages] = useState(false);
  const [analyzingImages, setAnalyzingImages] = useState(false);
  const [colorSwatches, setColorSwatches] = useState({});
  const [imageLinkDraft, setImageLinkDraft] = useState('');
  const [colorDraft, setColorDraft] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchKnowledge(tab === 'all' ? undefined : tab);
      setItems(data.items ?? []);
      setCounts(data.counts ?? { all: 0, product: 0, faq: 0 });
    } catch (err) {
      setError(err.message ?? 'تعذر تحميل قاعدة المعرفة');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const tabLabels = useMemo(
    () =>
      TABS.map((t) => ({
        ...t,
        count: counts[t.id] ?? 0,
      })),
    [counts]
  );

  async function handleDelete(id) {
    if (!window.confirm('حذف هذا العنصر؟')) return;
    try {
      await deleteKnowledgeItem(id);
      setToast('تم الحذف');
      load();
    } catch (err) {
      setError(err.message ?? 'تعذر الحذف');
    }
  }

  async function submitForm(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (form.id) {
        await updateKnowledgeItem(form.id, form);
        setToast('تم التعديل');
      } else {
        await createKnowledgeItem(form);
        setToast('تمت الإضافة');
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err.message ?? 'تعذر الحفظ');
    } finally {
      setSaving(false);
    }
  }

  async function submitCopilot(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data = await generateKnowledgeCopilot(copilotBrief);
      setModal(null);
      setCopilotBrief('');
      setToast(data.message ?? 'تم التوليد');
      load();
    } catch (err) {
      setError(err.message ?? 'تعذر التوليد');
    } finally {
      setSaving(false);
    }
  }

  /** Merge AI vision results into the form. Auto mode only fills empty fields. */
  function applyImageAnalysis(result, overwrite) {
    setForm((p) => ({
      ...p,
      title: overwrite || !p.title?.trim() ? result.title || p.title : p.title,
      description: overwrite || !p.description?.trim() ? result.description || p.description : p.description,
      colors: overwrite
        ? result.colors.length
          ? result.colors
          : p.colors
        : [...new Set([...(p.colors ?? []), ...result.colors])],
    }));
  }

  async function analyzeImages(urls, overwrite) {
    if (!urls.length) return;
    setAnalyzingImages(true);
    setError('');
    try {
      const result = await analyzeProductImages(urls);
      setColorSwatches((s) => ({ ...s, ...(result.colorHexes ?? {}) }));
      applyImageAnalysis(result, overwrite);
      setToast('تم تحليل الصور — راجع العنوان والوصف والألوان قبل الحفظ');
    } catch (err) {
      setError(err.message ?? 'تعذر تحليل الصور');
    } finally {
      setAnalyzingImages(false);
    }
  }

  async function handleProductImageUpload(e) {
    const files = [...(e.target.files ?? [])];
    if (!files.length) return;
    setUploadingImages(true);
    setError('');
    let uploadedUrls = [];
    try {
      const data = await uploadProductImages(files);
      const urls = data.urls ?? [];
      uploadedUrls = urls;
      setForm((p) => ({ ...p, imageUrls: [...new Set([...(p.imageUrls ?? []), ...urls])] }));
    } catch (err) {
      setError(err.message ?? 'تعذر رفع الصور');
    } finally {
      setUploadingImages(false);
      e.target.value = '';
    }
    if (uploadedUrls.length) {
      await analyzeImages(uploadedUrls, false);
    }
  }

  function openProductModal() {
    setImageLinkDraft('');
    setColorDraft('');
    setForm({
      type: 'PRODUCT',
      title: '',
      description: '',
      priceDh: '',
      imageUrls: [],
      colors: [],
      sizes: [],
    });
    setModal('product');
  }

  function openFaqModal() {
    setForm({ type: 'FAQ', title: '', answer: '' });
    setModal('faq');
  }

  function openEditFaq(item) {
    setForm({
      id: item.id,
      type: 'FAQ',
      title: item.title,
      answer: item.answer || item.description || '',
    });
    setModal('faq');
  }

  function openEditProduct(item) {
    setImageLinkDraft('');
    setColorDraft('');
    setForm({
      id: item.id,
      type: 'PRODUCT',
      title: item.title,
      description: item.description ?? '',
      priceDh: item.priceDh ?? '',
      imageUrls: item.imageUrls?.length ? item.imageUrls : item.imageUrl ? [item.imageUrl] : [],
      colors: item.colors ?? [],
      sizes: item.sizes ?? [],
    });
    setModal('product');
  }

  return (
    <section className="space-y-6">
      {toast ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm text-white shadow-lg"
        >
          {toast}
        </div>
      ) : null}

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="text-right">
          <h1 className="text-2xl font-bold text-white">قاعدة المعرفة والمنتجات (Knowledge Base)</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            إضافة وتحديث المنتجات والأسئلة مع ميزة التوليد التلقائي عبر الذكاء الاصطناعي (AI Copilot)
          </p>
        </div>
        {isAdmin ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setModal('copilot')}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
            >
              ✨ توليد بالـ AI Copilot
            </button>
            <button
              type="button"
              onClick={openFaqModal}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500"
            >
              + إضافة سؤال (FAQ)
            </button>
            <button
              type="button"
              onClick={openProductModal}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              📦 إضافة منتج / خدمة
            </button>
          </div>
        ) : null}
      </header>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-1">
        {tabLabels.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              'rounded-t-lg px-4 py-2 text-sm font-medium transition',
              tab === t.id
                ? 'border-b-2 border-emerald-500 text-emerald-300'
                : 'text-slate-500 hover:text-slate-200',
            ].join(' ')}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">جاري التحميل…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-12 text-center text-sm text-slate-500">
          لا توجد عناصر بعد. {isAdmin ? 'أضف منتجاً أو سؤالاً شائعاً.' : ''}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) =>
            item.type === 'FAQ' ? (
              <FaqCard
                key={item.id}
                item={item}
                onEdit={openEditFaq}
                onDelete={handleDelete}
                canEdit={isAdmin}
              />
            ) : (
              <ProductCard
                key={item.id}
                item={item}
                onEdit={openEditProduct}
                onDelete={handleDelete}
                canEdit={isAdmin}
              />
            )
          )}
        </div>
      )}

      {modal === 'product' ? (
        <Modal
          wide
          title={form.id ? 'تعديل منتج / خدمة' : 'إضافة منتج / خدمة'}
          onClose={() => setModal(null)}
        >
          <form onSubmit={submitForm} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-slate-300">الاسم</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">الوصف</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">الثمن (DH)</label>
              <input
                type="number"
                min={0}
                value={form.priceDh}
                onChange={(e) => setForm((p) => ({ ...p, priceDh: e.target.value }))}
                className="w-full max-w-xs rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white"
              />
            </div>
            <ProductMediaFields
              form={form}
              setForm={setForm}
              uploading={uploadingImages}
              onUpload={handleProductImageUpload}
              analyzing={analyzingImages}
              onAnalyze={(urls) => analyzeImages(urls, true)}
              swatches={colorSwatches}
              onSwatch={(name, hex) => setColorSwatches((s) => ({ ...s, [name]: hex }))}
              imageLink={imageLinkDraft}
              setImageLink={setImageLinkDraft}
              colorDraft={colorDraft}
              setColorDraft={setColorDraft}
            />
            <button
              type="submit"
              disabled={saving || uploadingImages || analyzingImages}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'جاري الحفظ…' : 'حفظ'}
            </button>
          </form>
        </Modal>
      ) : null}

      {modal === 'faq' ? (
        <Modal title={form.id ? 'تعديل سؤال شائع' : 'إضافة سؤال شائع'} onClose={() => setModal(null)}>
          <form onSubmit={submitForm} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-slate-300">السؤال</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">الجواب</label>
              <textarea
                required
                rows={4}
                value={form.answer}
                onChange={(e) => setForm((p) => ({ ...p, answer: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-cyan-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'جاري الحفظ…' : 'حفظ'}
            </button>
          </form>
        </Modal>
      ) : null}

      {modal === 'copilot' ? (
        <Modal title="AI Copilot — توليد كتالوج وFAQ" onClose={() => setModal(null)}>
          <form onSubmit={submitCopilot} className="space-y-4">
            <p className="text-sm text-slate-400">صف متجرك أو نوع المنتجات (مثلاً: إكسسوارات تقنية في المغرب).</p>
            <textarea
              rows={4}
              value={copilotBrief}
              onChange={(e) => setCopilotBrief(e.target.value)}
              placeholder="متجر سماعات وساعات ذكية مع توصيل لجميع المدن..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
            />
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'جاري التوليد…' : 'توليد'}
            </button>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
