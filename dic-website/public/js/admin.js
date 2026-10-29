(function () {
  'use strict';
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-confirm]');
    if (b && !window.confirm(b.getAttribute('data-confirm'))) e.preventDefault();
  });
  // Editor rich text (Quill). Isi disalin ke input tersembunyi saat submit; server menyaring ulang HTML.
  var boxes = document.querySelectorAll('.editor');
  if (boxes.length && window.Quill) {
    var editors = [];
    boxes.forEach(function (el) {
      var q = new Quill(el, { theme: 'snow', modules: { toolbar: [[{ header: [2, 3, false] }], ['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['blockquote', 'link'], ['clean']] } });
      editors.push([q, document.getElementById(el.getAttribute('data-target'))]);
    });
    var form = document.getElementById('cms-form');
    if (form) form.addEventListener('submit', function () {
      editors.forEach(function (p) { p[1].value = p[0].root.innerHTML === '<p><br></p>' ? '' : p[0].root.innerHTML; });
    });
  }
})();
