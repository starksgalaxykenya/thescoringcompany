// script.js (enhanced with extra vendor fields and certificate modal)
let vendors = [];
let activePlat = 'name';

function switchTab(t) {
  ['biz','prod'].forEach(id => {
    document.getElementById('tab-'+id).classList.toggle('active', id===t);
    document.getElementById('panel-'+id).classList.toggle('active', id===t);
  });
  clearRes();
}

function selectPlatform(el) {
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
  activePlat = el.dataset.p;
  const labels = {
    name:'Enter business name or #SC badge…', tiktok:'TikTok @handle…',
    instagram:'Instagram @handle…', facebook:'Facebook page name or URL…',
    whatsapp:'WhatsApp number or name…', jiji:'Jiji store name…', other:'Any handle or name…'
  };
  document.getElementById('biz-input').placeholder = labels[activePlat]||'Search…';
}

async function loadVendors() {
  try {
    const snap = await db.collection('vendors').get();
    vendors = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    document.getElementById('s-verified').textContent = vendors.length;
    buildSuggestions();
    loadStats();
  } catch(e) { console.error(e); }
}

async function loadStats() {
  try {
    const rSnap = await db.collection('fraudReports').get();
    document.getElementById('s-reports').textContent = rSnap.size;
    let revTotal = 0;
    for (const v of vendors.slice(0,10)) {
      try {
        const rs = await db.collection('vendors').doc(v.id).collection('reviews').get();
        revTotal += rs.size;
      } catch(e) {}
    }
    document.getElementById('s-reviews').textContent = revTotal + (vendors.length > 10 ? '+' : '');
  } catch(e) {}
}

function buildSuggestions() {
  const tags = new Set();
  vendors.forEach(v => {
    if (v.products) v.products.split(/[,;]+/).map(p=>p.trim()).filter(Boolean).forEach(t => tags.add(t));
  });
  const container = document.getElementById('prod-sugs');
  if ([...tags].length === 0) return;
  container.innerHTML = `<div class="sug-label">Popular searches</div><div class="sugs" id="sugs-inner"></div>`;
  const inner = document.getElementById('sugs-inner');
  [...tags].slice(0,8).forEach(tag => {
    const b = document.createElement('button');
    b.className = 'sug-chip'; b.textContent = tag;
    b.onclick = () => { document.getElementById('prod-input').value = tag; prodSearch(); };
    inner.appendChild(b);
  });
}

function bizSearch() {
  const q = document.getElementById('biz-input').value.trim();
  if (!q) return toast('Enter something to search','err');
  const plabels = {name:'Business Name',tiktok:'TikTok',instagram:'Instagram',facebook:'Facebook',whatsapp:'WhatsApp',jiji:'Jiji',other:'All Platforms'};
  const results = filterBiz(q);
  showRes(results, `"${q}" · ${plabels[activePlat]||activePlat}`);
}

function prodSearch() {
  const q = document.getElementById('prod-input').value.trim();
  if (!q) return toast('Enter a product or service','err');
  const lq = q.toLowerCase();
  const results = vendors.filter(v =>
    (v.products||'').toLowerCase().includes(lq) || (v.description||'').toLowerCase().includes(lq)
  );
  showRes(results, `Businesses selling "${q}"`);
}

function filterBiz(q) {
  const lq = q.toLowerCase().replace(/^@/,'');
  return vendors.filter(v => {
    if (activePlat === 'name') return (v.businessName||'').toLowerCase().includes(lq) || (v.badgeNumber||'').toLowerCase().includes(lq);
    if (activePlat === 'other') return anyMatch(v,lq);
    return platformMatch(v, activePlat, lq);
  });
}

function anyMatch(v,q) {
  return (v.businessName||'').toLowerCase().includes(q) || (v.badgeNumber||'').toLowerCase().includes(q) ||
    ['tiktok','facebook','instagram','whatsapp','jiji'].some(f => (v[f]||'').toLowerCase().includes(q)) ||
    (v.socialHandles||[]).some(h=>h.toLowerCase().includes(q));
}

function platformMatch(v,p,q) {
  return (v[p]||'').toLowerCase().includes(q) ||
    (v.socialHandles||[]).some(h=>h.toLowerCase().includes(p)&&h.toLowerCase().includes(q)) ||
    (v.businessName||'').toLowerCase().includes(q);
}

function showRes(list, title) {
  const res = document.getElementById('res');
  const container = document.getElementById('vcards');
  res.style.display = 'block';
  document.getElementById('res-title').textContent = title;
  document.getElementById('res-count').textContent = list.length;
  if (!list.length) {
    container.innerHTML = `<div class="empty"><i class="fas fa-store-slash"></i><h3>No businesses found</h3><p>Try a different search term or platform.</p></div>`;
    return;
  }
  container.innerHTML = `<div class="loading"><div class="spin"></div><p>Loading…</p></div>`;
  renderCards(list, container);
}

async function renderCards(list, container) {
  container.innerHTML = '';
  for (const v of list) {
    let reviews = [];
    try {
      const snap = await db.collection('vendors').doc(v.id).collection('reviews').orderBy('timestamp','desc').get();
      reviews = snap.docs.map(d=>d.data());
    } catch(e) {}
    const avg = reviews.length ? reviews.reduce((s,r)=>s+(r.rating||0),0)/reviews.length : null;
    const card = document.createElement('div');
    card.className = 'vcard';
    card.innerHTML = buildCard(v, reviews, avg);
    container.appendChild(card);
    wireCard(card, v, reviews);
  }
}

function buildCard(v, reviews, avg) {
  const init = (v.businessName||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  const stars = avg ? '★'.repeat(Math.round(avg))+'☆'.repeat(5-Math.round(avg)) : '☆☆☆☆☆';
  const rLabel = avg ? `${avg.toFixed(1)} · ${reviews.length} review${reviews.length!==1?'s':''}` : 'No reviews yet';
  const socials = buildSocials(v);
  const ptags = (v.products||'').split(/[,;]+/).map(p=>p.trim()).filter(Boolean).map(p=>`<span class="ptag">${esc(p)}</span>`).join('');
  const revHtml = reviews.length
    ? reviews.slice(0,3).map(r=>`
      <div class="rev-item">
        <div class="rev-stars">${'★'.repeat(r.rating||0)}${'☆'.repeat(5-(r.rating||0))}</div>
        <div class="rev-text">${esc(r.comment)}</div>
        <div class="rev-date">${r.timestamp?.toDate?.().toLocaleDateString('en-KE',{year:'numeric',month:'short',day:'numeric'})||'Recently'}</div>
      </div>`).join('')
    : `<p class="no-revs">No reviews yet — be the first!</p>`;

  // NEW SECTIONS (extra fields)
  const legalInfo = renderLegalInfo(v);
  const ownerInfo = renderOwnerInfo(v);
  const phonesList = renderPhones(v);
  const businessProcess = v.businessProcess ? `<div class="det-section"><div class="det-heading">Business Process</div><div class="iblock-val">${esc(v.businessProcess)}</div></div>` : '';
  const locationsHtml = renderLocations(v);
  const paymentDetailsHtml = renderPaymentDetails(v);
  const returnPolicyHtml = v.returnPolicy ? `<div class="det-section"><div class="det-heading">Return Policy</div><div class="iblock-val">${esc(v.returnPolicy)}</div></div>` : '';
  const termsHtml = v.termsConditions ? `<div class="det-section"><div class="det-heading">Terms & Conditions</div><div class="iblock-val">${esc(v.termsConditions)}</div></div>` : '';
  const otherInfoHtml = v.otherInfo ? `<div class="det-section"><div class="det-heading">Additional Information</div><div class="iblock-val">${esc(v.otherInfo)}</div></div>` : '';
  const linksHtml = renderLinks(v);
  const certHtml = renderCertificateButton(v);

  return `
  <div class="vcard-top">
    <div class="vavatar">${esc(init)}</div>
    <div class="vmain">
      <div class="vtop-row">
        <span class="vtag-verified"><i class="fas fa-circle-check" style="font-size:9px;"></i> Verified</span>
        ${v.badgeNumber?`<span class="vtag-badge">#${esc(v.badgeNumber)}</span>`:''}
      </div>
      <div class="vname">${esc(v.businessName)}</div>
      ${v.description?`<div class="vdesc">${esc(v.description)}</div>`:''}
      <div class="vstars">
        <span class="star-icons">${stars}</span>
        <span class="star-meta">${rLabel}</span>
      </div>
    </div>
    <button class="vexpand" title="View details"><i class="fas fa-chevron-down"></i></button>
  </div>
  <div class="vdetails">
    ${socials?`<div class="det-section"><div class="det-heading">Online Presence</div><div class="socials">${socials}</div></div>`:''}
    <div class="igrids">
      <div class="iblock"><div class="iblock-label">Products & Services</div><div class="iblock-val">${v.products||'Not specified'}</div></div>
      <div class="iblock"><div class="iblock-label">Contact</div><div class="iblock-val">${v.phone?`<div>${esc(v.phone)}</div>`:''}${v.email?`<div><a href="mailto:${esc(v.email)}">${esc(v.email)}</a></div>`:''}${v.location?`<div>${esc(v.location)}</div>`:''}${!v.phone&&!v.email&&!v.location?'Not provided':''}</div></div>
    </div>
    ${legalInfo}
    ${ownerInfo}
    ${phonesList}
    ${businessProcess}
    ${locationsHtml}
    ${paymentDetailsHtml}
    ${returnPolicyHtml}
    ${termsHtml}
    ${otherInfoHtml}
    ${linksHtml}
    ${ptags?`<div class="ptags">${ptags}</div>`:''}
    <div class="det-section"><div class="det-heading">Community Reviews</div><div class="rev-list">${revHtml}</div></div>
    <div class="acts">
      <button class="btn-act btn-rate-act"><i class="fas fa-star" style="font-size:12px;"></i> Rate Business</button>
      <button class="btn-act btn-rep-act"><i class="fas fa-flag" style="font-size:12px;"></i> Report Fraud</button>
    </div>
    ${certHtml}
    <div class="rform" id="rf-${v.id}">
      <h4>Rate ${esc(v.businessName)}</h4>
      <div class="spicker" id="sp-${v.id}">${[1,2,3,4,5].map(n=>`<i class="far fa-star" data-v="${n}"></i>`).join('')}</div>
      <textarea id="rc-${v.id}" placeholder="Share your experience…"></textarea>
      <div class="rform-btns">
        <button class="btn-act btn-rate-act" id="rs-${v.id}"><i class="fas fa-paper-plane"></i> Submit</button>
        <button class="btn-tiny" onclick="document.getElementById('rf-${v.id}').classList.remove('open')">Cancel</button>
      </div>
    </div>
  </div>`;
}

// Helper functions for new fields
function renderLegalInfo(v) {
  if (!v.kraPin && !v.registrationDocs) return '';
  let html = '<div class="det-section"><div class="det-heading">Legal Information</div><div class="legal-blocks">';
  if (v.kraPin) {
    let masked = v.kraPin.slice(0, -4) + '****';
    html += `<div class="legal-item"><i class="fas fa-file-invoice"></i> KRA PIN: ${esc(masked)}</div>`;
  }
  if (v.registrationDocs) {
    let docs = Array.isArray(v.registrationDocs) ? v.registrationDocs : [v.registrationDocs];
    docs.forEach(doc => {
      html += `<div class="legal-item"><i class="fas fa-file-pdf"></i> <a href="${esc(doc)}" target="_blank" class="doc-link">Registration Document</a></div>`;
    });
  }
  html += '</div></div>';
  return html;
}

function renderOwnerInfo(v) {
  if (!v.ownerName && !v.contactPerson) return '';
  let html = '<div class="det-section"><div class="det-heading">Owner / Contact Person</div><div class="owner-info">';
  if (v.ownerName) html += `<div><i class="fas fa-user"></i> Owner: ${esc(v.ownerName)}</div>`;
  if (v.contactPerson) html += `<div><i class="fas fa-user-tie"></i> Contact Person: ${esc(v.contactPerson)}</div>`;
  html += '</div></div>';
  return html;
}

function renderPhones(v) {
  let phones = [];
  if (v.phone) phones.push(v.phone);
  if (v.phones && Array.isArray(v.phones)) phones.push(...v.phones);
  if (phones.length === 0) return '';
  let html = '<div class="det-section"><div class="det-heading">Phone Numbers</div><div class="phones-list">';
  phones.forEach(p => {
    html += `<div class="phone-item"><i class="fas fa-phone-alt"></i> ${esc(p)}</div>`;
  });
  html += '</div></div>';
  return html;
}

function renderLocations(v) {
  let locations = [];
  if (v.location) locations.push({ address: v.location, mapUrl: v.googleMapsUrl });
  if (v.locations && Array.isArray(v.locations)) locations.push(...v.locations);
  if (locations.length === 0) return '';
  let html = '<div class="det-section"><div class="det-heading">Business Locations</div><div class="locations-list">';
  locations.forEach((loc, idx) => {
    let addr = typeof loc === 'string' ? loc : loc.address;
    let mapLink = (typeof loc === 'object' && loc.mapUrl) ? loc.mapUrl : `https://maps.google.com/?q=${encodeURIComponent(addr)}`;
    html += `<div class="location-item">
      <i class="fas fa-map-marker-alt"></i> ${esc(addr)}
      <a href="${mapLink}" target="_blank" class="maps-link"><i class="fas fa-external-link-alt"></i> View on Map</a>
    </div>`;
  });
  html += '</div></div>';
  return html;
}

function renderPaymentDetails(v) {
  let payments = [];
  if (v.paymentDetails && Array.isArray(v.paymentDetails)) payments = v.paymentDetails;
  else if (v.paymentDetails && typeof v.paymentDetails === 'string') payments = [{ method: v.paymentDetails }];
  if (payments.length === 0) return '';
  let html = '<div class="det-section"><div class="det-heading">Accepted Payment Methods</div><div class="payments-list">';
  payments.forEach(p => {
    let method = p.method || p;
    let details = p.details ? ` (${esc(p.details)})` : '';
    html += `<div class="payment-item"><i class="fas fa-credit-card"></i> ${esc(method)}${details}</div>`;
  });
  html += '</div></div>';
  return html;
}

function renderLinks(v) {
  let links = '';
  if (v.website) links += `<div><i class="fas fa-globe"></i> <a href="${esc(v.website)}" target="_blank">Website</a></div>`;
  if (v.appLink) links += `<div><i class="fas fa-mobile-alt"></i> <a href="${esc(v.appLink)}" target="_blank">Mobile App</a></div>`;
  if (!links) return '';
  return `<div class="det-section"><div class="det-heading">Links</div><div class="links-list">${links}</div></div>`;
}

function renderCertificateButton(v) {
  const isExpired = v.certificateExpiry && v.certificateExpiry.toDate() < new Date();
  const statusClass = isExpired ? 'expired' : 'active';
  const statusText = isExpired ? 'Expired' : 'Active';
  return `<div class="cert-section">
    <button class="btn-cert" onclick="showCertificate('${v.id}')">
      <i class="fas fa-certificate"></i> View Verified Certificate
    </button>
    <span class="cert-status-badge ${statusClass}">${statusText}</span>
  </div>`;
}

// Certificate modal
function showCertificate(vendorId) {
  const vendor = vendors.find(v => v.id === vendorId);
  if (!vendor) return;

  const isExpired = vendor.certificateExpiry && vendor.certificateExpiry.toDate() < new Date();
  const status = isExpired ? 'Expired' : 'Active';
  const statusClass = isExpired ? 'expired' : 'active';
  const issueDate = vendor.certificateIssueDate ? vendor.certificateIssueDate.toDate().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not set';
  const expiryDate = vendor.certificateExpiry ? vendor.certificateExpiry.toDate().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not set';
  const certNumber = vendor.certificateNumber || 'Not assigned';
  const verificationDate = new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });

  // Helper to format arrays or objects nicely
  const formatValue = (val) => {
    if (!val) return 'Not provided';
    if (Array.isArray(val)) return val.map(v => esc(v)).join(', ');
    if (typeof val === 'object') return JSON.stringify(val);
    return esc(val);
  };

  // Build detailed business info HTML
  const businessDetails = `
    <div class="cert-details-full">
      <h4>Business Information</h4>
      <p><strong>Business Name:</strong> ${esc(vendor.businessName)}</p>
      <p><strong>Verification #:</strong> ${esc(vendor.badgeNumber || '—')}</p>
      <p><strong>Description:</strong> ${esc(vendor.description || '—')}</p>
      <p><strong>Products/Services:</strong> ${esc(vendor.products || '—')}</p>
      
      <h4>Contact & Social</h4>
      <p><strong>Phone(s):</strong> ${formatValue(vendor.phones || vendor.phone)}</p>
      <p><strong>Email:</strong> ${esc(vendor.email || '—')}</p>
      <p><strong>Website:</strong> ${vendor.website ? `<a href="${esc(vendor.website)}" target="_blank">${esc(vendor.website)}</a>` : '—'}</p>
      <p><strong>Instagram:</strong> ${esc(vendor.instagram || '—')}</p>
      <p><strong>TikTok:</strong> ${esc(vendor.tiktok || '—')}</p>
      <p><strong>Facebook:</strong> ${esc(vendor.facebook || '—')}</p>
      <p><strong>WhatsApp:</strong> ${esc(vendor.whatsapp || '—')}</p>
      
      <h4>Legal & Owner</h4>
      <p><strong>KRA PIN:</strong> ${vendor.kraPin ? vendor.kraPin.slice(0, -4) + '****' : '—'}</p>
      <p><strong>Owner/Contact Person:</strong> ${esc(vendor.ownerName || vendor.contactPerson || '—')}</p>
      
      <h4>Location(s)</h4>
      ${renderLocationsForCert(vendor)}
      
      <h4>Payment Methods</h4>
      <p>${formatValue(vendor.paymentDetails)}</p>
      
      <h4>Return Policy & T&Cs</h4>
      <p><strong>Return Policy:</strong> ${esc(vendor.returnPolicy || '—')}</p>
      <p><strong>Terms & Conditions:</strong> ${esc(vendor.termsConditions || '—')}</p>
      
      <h4>Additional Info</h4>
      <p>${esc(vendor.otherInfo || '—')}</p>
    </div>
  `;

  const modal = document.createElement('div');
  modal.className = 'moverlay';
  modal.innerHTML = `
    <div class="mbox cert-mbox cert-mbox-large">
      <div class="cert-header">
        <i class="fas fa-shield-alt"></i>
        <h2>Verification Certificate</h2>
        <button class="cert-close" onclick="this.closest('.moverlay').remove()">&times;</button>
      </div>
      <div class="cert-body">
        <p class="cert-issuer">Issued by <strong>The Scoring Company</strong> · Kenya</p>
        <div class="cert-badge">
          <div class="cert-number">Certificate № ${esc(certNumber)}</div>
          <div class="cert-status ${statusClass}">${status}</div>
        </div>
        <div class="cert-dates">
          <span><strong>Issue Date:</strong> ${issueDate}</span>
          <span><strong>Expiry Date:</strong> ${expiryDate}</span>
        </div>
        ${businessDetails}
        <div class="cert-seal"><i class="fas fa-check-circle"></i> Verified by The Scoring Company</div>
        <div class="cert-print-date">Generated on ${verificationDate}</div>
      </div>
      <div class="cert-footer">
        <button class="btn-tiny" onclick="window.print()"><i class="fas fa-print"></i> Print</button>
        <button class="btn-tiny" onclick="this.closest('.moverlay').remove()">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// Helper for locations inside certificate
function renderLocationsForCert(v) {
  let locations = [];
  if (v.location) locations.push({ address: v.location, mapUrl: v.googleMapsUrl });
  if (v.locations && Array.isArray(v.locations)) locations.push(...v.locations);
  if (locations.length === 0) return '<p>—</p>';
  let html = '<ul class="cert-locations">';
  locations.forEach(loc => {
    let addr = typeof loc === 'string' ? loc : loc.address;
    let mapLink = (typeof loc === 'object' && loc.mapUrl) ? loc.mapUrl : `https://maps.google.com/?q=${encodeURIComponent(addr)}`;
    html += `<li>${esc(addr)} <a href="${mapLink}" target="_blank">(View Map)</a></li>`;
  });
  html += '</ul>';
  return html;
}
function buildSocials(v) {
  const l = [];
  if(v.tiktok)    l.push(`<a class="spill tt" href="https://tiktok.com/@${encodeURIComponent(v.tiktok.replace('@',''))}" target="_blank"><i class="fab fa-tiktok"></i>${esc(v.tiktok)}</a>`);
  if(v.instagram) l.push(`<a class="spill ig" href="https://instagram.com/${encodeURIComponent(v.instagram.replace('@',''))}" target="_blank"><i class="fab fa-instagram"></i>${esc(v.instagram)}</a>`);
  if(v.facebook)  l.push(`<a class="spill fb" href="${v.facebook.startsWith('http')?v.facebook:'https://facebook.com/'+encodeURIComponent(v.facebook)}" target="_blank"><i class="fab fa-facebook"></i>${esc(v.facebook)}</a>`);
  if(v.whatsapp)  l.push(`<a class="spill wa" href="https://wa.me/${v.whatsapp.replace(/\D/g,'')}" target="_blank"><i class="fab fa-whatsapp"></i>${esc(v.whatsapp)}</a>`);
  if(v.jiji)      l.push(`<a class="spill jj" href="${v.jiji.startsWith('http')?v.jiji:'#'}" target="_blank"><i class="fas fa-store-alt"></i>${esc(v.jiji)}</a>`);
  if(v.website)   l.push(`<a class="spill web" href="${v.website}" target="_blank"><i class="fas fa-globe"></i>Website</a>`);
  if(v.socialHandles) v.socialHandles.forEach(h=>{ if(!l.find(s=>s.includes(esc(h)))) l.push(`<span class="spill">${esc(h)}</span>`); });
  return l.join('');
}

function wireCard(card, v) {
  const details = card.querySelector('.vdetails');
  const expBtn  = card.querySelector('.vexpand');
  expBtn.addEventListener('click', () => {
    const open = details.classList.toggle('open');
    expBtn.classList.toggle('open', open);
  });
  card.querySelector('.btn-rate-act').addEventListener('click', () => {
    document.getElementById(`rf-${v.id}`).classList.toggle('open');
  });
  card.querySelector('.btn-rep-act').addEventListener('click', () => showReport(v.id, v.businessName));
  let selRating = 5;
  const picker = document.getElementById(`sp-${v.id}`);
  if (picker) {
    const stars = picker.querySelectorAll('i');
    stars.forEach(s => {
      s.addEventListener('click', () => {
        selRating = +s.dataset.v;
        stars.forEach((st,i) => { st.className = i<selRating?'fas fa-star on':'far fa-star'; });
      });
    });
    const sb = document.getElementById(`rs-${v.id}`);
    if (sb) sb.addEventListener('click', async () => {
      const comment = document.getElementById(`rc-${v.id}`).value;
      try {
        await db.collection('vendors').doc(v.id).collection('reviews').add({
          rating: selRating, comment: comment||'No comment',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        toast('Rating submitted — thank you!','ok');
        document.getElementById(`rf-${v.id}`).classList.remove('open');
      } catch(e) { toast('Could not submit. Try again.','err'); }
    });
  }
}

function showReport(vid, vname) {
  const m = document.createElement('div');
  m.className = 'moverlay';
  m.innerHTML = `<div class="mbox"><h3><i class="fas fa-flag" style="color:#DC2626;"></i> Report Fraud</h3><p class="msub">Reporting: ${esc(vname)}</p><textarea id="fr-desc" placeholder="Describe the fraudulent activity clearly…"></textarea><label class="file-lbl" for="fr-file"><i class="fas fa-paperclip"></i> Attach evidence</label><input type="file" id="fr-file" accept="image/*,video/*"><div class="fname-display" id="fr-fname"></div><div class="mbtns"><button class="btn-act btn-rep-act" id="fr-submit">Submit Report</button><button class="btn-tiny" id="fr-close">Cancel</button></div></div>`;
  document.body.appendChild(m);
  m.querySelector('#fr-file').addEventListener('change',e=>{ const f=e.target.files[0]; if(f) m.querySelector('#fr-fname').textContent='📎 '+f.name; });
  m.querySelector('#fr-close').addEventListener('click',()=>m.remove());
  m.querySelector('#fr-submit').addEventListener('click', async () => {
    const desc = m.querySelector('#fr-desc').value.trim();
    if (!desc) return toast('Please describe the fraud','err');
    let mediaUrl = null;
    const file = m.querySelector('#fr-file').files[0];
    try {
      if (file) {
        const ref = storage.ref(`fraud_reports/${vid}/${Date.now()}_${file.name}`);
        mediaUrl = await (await ref.put(file)).ref.getDownloadURL();
      }
      await db.collection('fraudReports').add({ vendorId:vid, vendorName:vname, description:desc, mediaUrl, reportedAt:firebase.firestore.FieldValue.serverTimestamp(), status:'pending' });
      toast('Report submitted. Admin will review it.','ok');
      m.remove();
    } catch(e) { toast('Failed to submit report.','err'); }
  });
}

function clearRes() {
  document.getElementById('res').style.display = 'none';
  document.getElementById('vcards').innerHTML = '';
  document.getElementById('biz-input').value = '';
  document.getElementById('prod-input').value = '';
}

function toast(msg, type='ok') {
  const t = document.createElement('div');
  const icon = type==='ok' ? 'fa-circle-check' : 'fa-circle-exclamation';
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fas ${icon}"></i> ${msg}`;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 3200);
}

function esc(s) {
  if (!s) return '';
  return s.replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

document.getElementById('biz-btn').addEventListener('click', bizSearch);
document.getElementById('prod-btn').addEventListener('click', prodSearch);
document.getElementById('biz-input').addEventListener('keyup', e=>{ if(e.key==='Enter') bizSearch(); });
document.getElementById('prod-input').addEventListener('keyup', e=>{ if(e.key==='Enter') prodSearch(); });
loadVendors();
