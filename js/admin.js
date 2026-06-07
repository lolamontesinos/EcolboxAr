(function () {
  'use strict';

  const SESSION_KEY = 'ecolbox-admin-session';
  const PASSWORD_SESSION_KEY = 'ecolbox-admin-pwd';
  const ADMIN_PASSWORD = 'ecolbox';
  const API_URL = '/api/content';

  const EDITABLE_SELECTOR = [
    'header .logo-text',
    'header .nav-links a:not(.btn)',
    'header .nav-links .btn',
    'main h1',
    'main h2',
    'main h3',
    'main h4',
    'main p',
    'main li',
    'main blockquote',
    'main .hero-badge',
    'main .section-tag',
    'main .stat-value',
    'main .stat-label',
    'main .card-icon',
    'main .value-number',
    'main .timeline-dot',
    'main .timeline-content h3',
    'main .timeline-content p',
    'main .banner-label',
    'main .banner-text h2',
    'main .banner-text p',
    'main .testimonial-card p',
    'main .testimonial-card footer',
    'main .hero-slide-caption',
    'main .pricing-card h3',
    'main .pricing-desc',
    'main .pricing-price',
    'main .pricing-features li',
    'main .team-label',
    'main .team-list li',
    'main .visual-number',
    'main .visual-note',
    'main .box-showcase-caption',
    'main .btn',
    'main .challenge-list strong',
    'main .challenge-list span',
    'footer .footer-brand p',
    'footer h4',
    'footer li',
    'footer a',
    'footer .footer-copy-text',
  ].join(', ');

  const CSS_VARS = [
    { key: '--color-primary', label: 'Color principal' },
    { key: '--color-primary-dark', label: 'Color oscuro' },
    { key: '--color-accent', label: 'Color acento' },
    { key: '--color-bg', label: 'Fondo' },
  ];

  let adminActive = false;
  let editableElements = [];
  let selectedSection = null;
  let selectedLink = null;
  let toolbar = null;
  let adminPassword = null;
  let isSaving = false;

  function emptyContent() {
    return { elements: {}, links: {}, styles: {}, hiddenSections: [] };
  }

  function assignEditIds() {
    document.querySelectorAll(EDITABLE_SELECTOR).forEach((el, index) => {
      if (!el.dataset.editId) {
        el.dataset.editId = `edit-${index}-${el.tagName.toLowerCase()}`;
      }
    });
  }

  function applyContent(data) {
    if (!data) return;

    assignEditIds();

    Object.entries(data.elements || {}).forEach(([id, value]) => {
      const el = document.querySelector(`[data-edit-id="${id}"]`);
      if (el && value != null) el.innerHTML = value;
    });

    Object.entries(data.links || {}).forEach(([id, href]) => {
      const el = document.querySelector(`[data-edit-id="${id}"]`);
      if (el && el.tagName === 'A' && href != null) el.setAttribute('href', href);
    });

    Object.entries(data.styles || {}).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });

    document.querySelectorAll('.admin-hidden').forEach((el) => {
      el.classList.remove('admin-hidden');
    });

    (data.hiddenSections || []).forEach((sectionId) => {
      const section = document.getElementById(sectionId);
      if (section) section.classList.add('admin-hidden');
    });
  }

  async function fetchRemoteContent() {
    const response = await fetch(API_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo cargar el contenido');
    return response.json();
  }

  async function loadAndApplyContent() {
    try {
      const data = await fetchRemoteContent();
      applyContent(data);
    } catch (err) {
      console.warn('Usando contenido por defecto:', err.message);
    }
  }

  function collectContent() {
    assignEditIds();

    const elements = {};
    const links = {};

    document.querySelectorAll('[data-edit-id]').forEach((el) => {
      elements[el.dataset.editId] = el.innerHTML;
      if (el.tagName === 'A') {
        links[el.dataset.editId] = el.getAttribute('href') || '#';
      }
    });

    const styles = {};
    CSS_VARS.forEach(({ key }) => {
      const value = getComputedStyle(document.documentElement).getPropertyValue(key).trim();
      if (value) styles[key] = value;
    });

    const hiddenSections = [...document.querySelectorAll('section.admin-hidden, .hero.admin-hidden, .cta-section.admin-hidden')]
      .map((el) => el.id)
      .filter(Boolean);

    return { elements, links, styles, hiddenSections };
  }

  async function saveRemoteContent(data, action) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: adminPassword,
        action,
        data,
      }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Error al guardar');
    return result;
  }

  function showToast(message, isError) {
    let toast = document.querySelector('.admin-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'admin-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.toggle('admin-toast-error', !!isError);
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 3200);
  }

  function setSaveLoading(loading) {
    isSaving = loading;
    const btn = toolbar?.querySelector('#admin-save');
    if (btn) {
      btn.disabled = loading;
      btn.textContent = loading ? 'Guardando…' : 'Guardar para todos';
    }
  }

  function createToolbar() {
    if (toolbar) return toolbar;

    toolbar = document.createElement('div');
    toolbar.className = 'admin-toolbar';
    toolbar.innerHTML = `
      <div class="admin-toolbar-inner">
        <span class="admin-toolbar-title">Modo admin</span>
        <span class="admin-toolbar-hint">Los cambios se guardan para todos los visitantes</span>
        <div class="admin-toolbar-colors" id="admin-colors"></div>
        <div class="admin-toolbar-link" id="admin-link-editor" hidden>
          <label>URL del enlace:</label>
          <input type="text" id="admin-link-input" placeholder="https://... o #seccion">
          <button type="button" class="admin-btn admin-btn-sm" id="admin-link-apply">Aplicar</button>
        </div>
        <div class="admin-toolbar-actions">
          <button type="button" class="admin-btn" id="admin-hide-section" disabled>Ocultar sección</button>
          <button type="button" class="admin-btn" id="admin-show-sections">Secciones ocultas</button>
          <button type="button" class="admin-btn admin-btn-primary" id="admin-save">Guardar para todos</button>
          <button type="button" class="admin-btn admin-btn-danger" id="admin-reset">Restablecer</button>
          <button type="button" class="admin-btn" id="admin-exit">Salir</button>
        </div>
      </div>
    `;

    document.body.appendChild(toolbar);

    const colorsContainer = toolbar.querySelector('#admin-colors');
    CSS_VARS.forEach(({ key, label }) => {
      const value = getComputedStyle(document.documentElement).getPropertyValue(key).trim();
      const wrap = document.createElement('label');
      wrap.className = 'admin-color-field';
      wrap.innerHTML = `<span>${label}</span><input type="color" data-var="${key}" value="${toHexColor(value)}">`;
      colorsContainer.appendChild(wrap);
    });

    colorsContainer.addEventListener('input', (e) => {
      const input = e.target.closest('input[type="color"]');
      if (!input) return;
      document.documentElement.style.setProperty(input.dataset.var, input.value);
    });

    toolbar.querySelector('#admin-save').addEventListener('click', async () => {
      if (isSaving) return;
      setSaveLoading(true);
      try {
        await saveRemoteContent(collectContent());
        showToast('Guardado — todos verán los cambios al recargar');
      } catch (err) {
        showToast(err.message, true);
      } finally {
        setSaveLoading(false);
      }
    });

    toolbar.querySelector('#admin-reset').addEventListener('click', async () => {
      if (!confirm('¿Restablecer la página al contenido original para TODOS los visitantes?')) return;

      setSaveLoading(true);
      try {
        await saveRemoteContent(emptyContent(), 'reset');
        sessionStorage.removeItem(SESSION_KEY);
        adminPassword = null;
        location.reload();
      } catch (err) {
        showToast(err.message, true);
        setSaveLoading(false);
      }
    });

    toolbar.querySelector('#admin-exit').addEventListener('click', exitAdmin);

    toolbar.querySelector('#admin-hide-section').addEventListener('click', () => {
      if (!selectedSection) return;
      selectedSection.classList.add('admin-hidden');
      selectedSection.classList.remove('admin-section-selected');
      selectedSection = null;
      updateSectionButton();
      showToast('Sección oculta — recordá guardar para todos');
    });

    toolbar.querySelector('#admin-show-sections').addEventListener('click', showHiddenSectionsMenu);

    toolbar.querySelector('#admin-link-apply').addEventListener('click', () => {
      if (selectedLink) {
        selectedLink.setAttribute('href', toolbar.querySelector('#admin-link-input').value || '#');
        showToast('Enlace actualizado — recordá guardar para todos');
      }
    });

    return toolbar;
  }

  function toHexColor(color) {
    if (!color) return '#2d6a4f';
    if (color.startsWith('#')) return color.length === 7 ? color : '#2d6a4f';
    const match = color.match(/\d+/g);
    if (!match || match.length < 3) return '#2d6a4f';
    return (
      '#' +
      match
        .slice(0, 3)
        .map((n) => Number(n).toString(16).padStart(2, '0'))
        .join('')
    );
  }

  function showHiddenSectionsMenu() {
    const hidden = [...document.querySelectorAll('.admin-hidden')];
    if (hidden.length === 0) {
      showToast('No hay secciones ocultas');
      return;
    }

    const names = hidden.map((el) => el.id || el.className.split(' ')[0]).join('\n• ');
    const choice = prompt(`Secciones ocultas:\n• ${names}\n\nEscribí el id de la sección para mostrarla de nuevo:`, hidden[0].id);
    if (!choice) return;

    const section = document.getElementById(choice);
    if (section) {
      section.classList.remove('admin-hidden');
      showToast('Sección visible — recordá guardar para todos');
    }
  }

  function updateSectionButton() {
    const btn = toolbar?.querySelector('#admin-hide-section');
    if (btn) btn.disabled = !selectedSection;
  }

  function updateLinkEditor(link) {
    const editor = toolbar?.querySelector('#admin-link-editor');
    const input = toolbar?.querySelector('#admin-link-input');
    if (!editor || !input) return;

    if (link && link.tagName === 'A') {
      selectedLink = link;
      editor.hidden = false;
      input.value = link.getAttribute('href') || '';
    } else {
      selectedLink = null;
      editor.hidden = true;
    }
  }

  function enableEditing() {
    editableElements = [...document.querySelectorAll(EDITABLE_SELECTOR)];
    assignEditIds();

    editableElements.forEach((el) => {
      el.setAttribute('contenteditable', 'true');
      el.classList.add('admin-editable');
      el.addEventListener('click', onEditableClick);
      el.addEventListener('blur', onEditableBlur);
      el.addEventListener('keydown', onEditableKeydown);
    });

    document.querySelectorAll('main section, .hero, .cta-section').forEach((section) => {
      if (!section.id) {
        section.id = section.classList.contains('hero') ? 'hero' : 'cta';
      }
      section.classList.add('admin-section');
      section.addEventListener('click', onSectionClick);
    });
  }

  function disableEditing() {
    editableElements.forEach((el) => {
      el.removeAttribute('contenteditable');
      el.classList.remove('admin-editable');
      el.removeEventListener('click', onEditableClick);
      el.removeEventListener('blur', onEditableBlur);
      el.removeEventListener('keydown', onEditableKeydown);
    });

    document.querySelectorAll('.admin-section').forEach((section) => {
      section.classList.remove('admin-section', 'admin-section-selected');
      section.removeEventListener('click', onSectionClick);
    });

    editableElements = [];
    selectedSection = null;
    selectedLink = null;
  }

  function onEditableClick(e) {
    if (!adminActive) return;
    e.stopPropagation();

    if (e.currentTarget.tagName === 'A') {
      e.preventDefault();
      updateLinkEditor(e.currentTarget);
    }

    if (selectedSection) {
      selectedSection.classList.remove('admin-section-selected');
      selectedSection = null;
      updateSectionButton();
    }
  }

  function onEditableBlur() {
    updateLinkEditor(null);
  }

  function onEditableKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey && e.currentTarget.tagName !== 'P' && !e.currentTarget.classList.contains('pricing-desc')) {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }

  function onSectionClick(e) {
    if (!adminActive) return;
    if (e.target.closest('[contenteditable="true"]')) return;

    e.stopPropagation();
    e.preventDefault();

    if (selectedSection) selectedSection.classList.remove('admin-section-selected');
    selectedSection = e.currentTarget;
    selectedSection.classList.add('admin-section-selected');
    updateSectionButton();
    updateLinkEditor(null);
  }

  function enterAdmin() {
    adminActive = true;
    sessionStorage.setItem(SESSION_KEY, '1');
    document.body.classList.add('admin-mode');
    createToolbar();
    enableEditing();
    showToast('Modo admin — guardá para que todos vean los cambios');
  }

  function exitAdmin() {
    adminActive = false;
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(PASSWORD_SESSION_KEY);
    adminPassword = null;
    document.body.classList.remove('admin-mode');
    disableEditing();
    if (selectedSection) selectedSection.classList.remove('admin-section-selected');
    showToast('Modo admin desactivado');
  }

  function requestAdminAccess() {
    const password = prompt('Contraseña de admin:');
    if (password === null) return;
    if (password === ADMIN_PASSWORD) {
      adminPassword = password;
      sessionStorage.setItem(PASSWORD_SESSION_KEY, password);
      enterAdmin();
    } else {
      alert('Contraseña incorrecta');
    }
  }

  async function init() {
    await loadAndApplyContent();

    adminPassword = sessionStorage.getItem(PASSWORD_SESSION_KEY);

    const trigger = document.getElementById('copyright-trigger');
    if (trigger) {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        if (adminActive) {
          exitAdmin();
        } else if (sessionStorage.getItem(SESSION_KEY) && adminPassword) {
          enterAdmin();
        } else {
          requestAdminAccess();
        }
      });
    }

    document.addEventListener('click', (e) => {
      if (!adminActive) return;
      if (selectedSection && !e.target.closest('.admin-section') && !e.target.closest('.admin-toolbar')) {
        selectedSection.classList.remove('admin-section-selected');
        selectedSection = null;
        updateSectionButton();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
