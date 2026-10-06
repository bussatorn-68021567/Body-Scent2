/* Body Scent - shared script for every page.
   Each block runs only if its elements exist on the current page. */

const ORDER_API_URL = 'https://script.google.com/macros/s/AKfycbxDCPaXaRz8vAtWLP17Ax5dyPiDaQ7abZgHvC2QeYN76sL7aLx6JKz46Jft6mJ4ASJn/exec';
const ORDERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSrPmeUp-4rJQSEm__Urhy0jEHx_HDQB-_Oifcb5T0H_ZcOEezBZS6r6olwErV0tkM3x9qV8cYYS86O/pub?gid=0&single=true&output=csv';

const MOODS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'fresh', label: 'Fresh' },
  { key: 'sweet', label: 'Sweet' },
  { key: 'confident', label: 'Confident' },
  { key: 'romance', label: 'Romance' }
];

/* ---------- 1. product.html ---------- */
function initProductPage() {
  const list = document.getElementById('product-list');
  const filterBar = document.getElementById('filter-bar');
  if (!list || !filterBar) return;

  let products = [];
  const params = new URLSearchParams(window.location.search);
  let currentMood = params.get('mood') || 'all';
  if (!MOODS.some(m => m.key === currentMood)) currentMood = 'all';

  function renderFilters() {
    filterBar.innerHTML = '';
    MOODS.forEach(m => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'filter-btn' + (m.key === currentMood ? ' active' : '');
      btn.textContent = m.label;
      btn.addEventListener('click', () => {
        currentMood = m.key;
        renderFilters();
        renderProducts();
      });
      filterBar.appendChild(btn);
    });
  }

  function itemLabel(p) {
    return p.size ? p.name + ' ' + p.size : p.name;
  }

  function renderProducts() {
    const shown = currentMood === 'all'
      ? products
      : products.filter(p => p.mood === currentMood);

    list.innerHTML = '';
    if (shown.length === 0) {
      list.innerHTML = '<p>ไม่พบสินค้าในหมวดนี้</p>';
      return;
    }

    shown.forEach(p => {
      const card = document.createElement('article');
      card.className = 'card mood-' + p.mood;

      const imgWrap = document.createElement('div');
      imgWrap.className = 'card-img';
      const img = document.createElement('img');
      img.src = p.image;
      img.alt = p.name;
      img.loading = 'lazy';
      imgWrap.appendChild(img);

      const title = document.createElement('h3');
      const dot = document.createElement('span');
      dot.className = 'mood-dot';
      title.appendChild(dot);
      title.appendChild(document.createTextNode(p.name));

      const meta = document.createElement('div');
      meta.className = 'card-meta';
      const size = document.createElement('span');
      size.className = 'size';
      size.textContent = p.size || (p.type === 'rollon' ? 'โรลออน' : '');
      const price = document.createElement('span');
      price.className = 'price';
      price.textContent = Number(p.price).toLocaleString('th-TH') + ' บาท';
      meta.appendChild(size);
      meta.appendChild(price);

      const btn = document.createElement('a');
      btn.className = 'btn btn-gold';
      btn.textContent = 'สั่งซื้อ';
      btn.href = 'order.html?item=' + encodeURIComponent(itemLabel(p)) +
                 '&price=' + encodeURIComponent(p.price);

      card.appendChild(imgWrap);
      card.appendChild(title);
      card.appendChild(meta);
      card.appendChild(btn);
      list.appendChild(card);
    });
  }

  renderFilters();
  fetch('products.json')
    .then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(data => {
      products = data;
      renderProducts();
    })
    .catch(err => {
      console.error(err);
      list.innerHTML = '<p>ไม่สามารถโหลดข้อมูลสินค้าได้ กรุณาลองใหม่อีกครั้ง</p>';
    });
}

/* ---------- 2. order.html ---------- */
function setFieldValue(el, value) {
  if (!el) return;
  if ('value' in el) el.value = value;
  else el.textContent = value;
}

function getFieldValue(el) {
  if (!el) return '';
  return ('value' in el ? el.value : el.textContent).trim();
}

function initOrderPage() {
  const form = document.getElementById('orderForm');
  if (!form) return;

  const params = new URLSearchParams(window.location.search);
  const item = params.get('item') || '';
  const price = params.get('price') || '';

  // Auto-fill both fields as soon as the page loads
  setFieldValue(document.getElementById('items'), item);
  setFieldValue(document.getElementById('total'), price);

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const payload = {
      customerName: getFieldValue(document.getElementById('customerName')),
      contact: getFieldValue(document.getElementById('contact')),
      items: getFieldValue(document.getElementById('items')),
      total: getFieldValue(document.getElementById('total')),
      note: getFieldValue(document.getElementById('note'))
    };

    fetch(ORDER_API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });
  });
}

/* ---------- 3. admin.html ---------- */
// Minimal CSV parser: quoted fields, escaped quotes (""), commas and newlines inside quotes
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

function initAdminPage() {
  const tbody = document.querySelector('#ordersTable tbody');
  if (!tbody) return;

  function showMessage(msg) {
    tbody.innerHTML = '';
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.textContent = msg;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  showMessage('กำลังโหลดข้อมูล...');

  // timestamp query avoids a stale cached copy of the sheet
  fetch(ORDERS_CSV_URL + '&t=' + Date.now())
    .then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(text => {
      const rows = parseCSV(text);
      rows.shift(); // header row
      rows.reverse(); // newest orders (appended last) first

      if (rows.length === 0) {
        showMessage('ยังไม่มีรายการสั่งซื้อ');
        return;
      }

      tbody.innerHTML = '';
      rows.forEach(r => {
        const tr = document.createElement('tr');
        for (let c = 0; c < 6; c++) {
          const td = document.createElement('td');
          td.textContent = r[c] || '';
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      });
    })
    .catch(err => {
      console.error(err);
      showMessage('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    });
}

document.addEventListener('DOMContentLoaded', () => {
  initProductPage();
  initOrderPage();
  initAdminPage();
});
