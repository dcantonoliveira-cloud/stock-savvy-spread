/* ============================================================
   RONDELLO BUFFET — Interações
   ============================================================ */
(function(){
  'use strict';

  /* Documento oculto no load (aba em 2º plano / captura): mostra tudo sem animação */
  var HIDDEN = (typeof document.hidden !== 'undefined') && document.hidden;
  if(HIDDEN){ document.documentElement.classList.add('reveal-now'); }
  document.addEventListener('visibilitychange', function(){
    if(!document.hidden){ HIDDEN = false; }
  });

  /* ---- Header scroll state ---- */
  var header = document.querySelector('.site-header');
  var toTop = document.querySelector('.to-top');
  function onScroll(){
    var y = window.scrollY || window.pageYOffset;
    if(header) header.classList.toggle('scrolled', y > 60);
    if(toTop) toTop.classList.toggle('show', y > 700);
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();

  /* ---- Mobile menu ---- */
  var burger = document.querySelector('.burger');
  var menu = document.querySelector('.mobile-menu');
  function closeMenu(){ if(menu){ menu.classList.remove('open'); document.body.style.overflow=''; } }
  if(burger && menu){
    burger.addEventListener('click', function(){
      menu.classList.add('open'); document.body.style.overflow='hidden';
    });
    menu.querySelectorAll('[data-close], nav a').forEach(function(el){
      el.addEventListener('click', closeMenu);
    });
  }

  /* ---- Reveal on scroll (detecção por viewport — robusta) ---- */
  var reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  function inView(el, f){
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < vh * (f || 0.88) && r.bottom > 0;
  }
  function revealEl(el){
    el.classList.add('in');
    // Rede de segurança por elemento: em contextos que congelam transições
    // (mesmo com o documento "visível"), a opacidade fica em ~0. Após 550ms,
    // se ainda não começou a aparecer, força o estado visível sem transição.
    // Em navegadores normais o fade já está em andamento (>0.05), então não interfere.
    setTimeout(function(){
      if(parseFloat(getComputedStyle(el).opacity) < 0.05){
        el.style.transition = 'none';
        el.style.opacity = '1';
        el.style.transform = 'none';
      }
    }, 550);
  }
  function checkReveals(f){
    for(var i = reveals.length - 1; i >= 0; i--){
      if(inView(reveals[i], f)){ revealEl(reveals[i]); reveals.splice(i, 1); }
    }
  }
  window.addEventListener('scroll', function(){ checkReveals(); }, {passive:true});
  window.addEventListener('resize', function(){ checkReveals(); });
  window.addEventListener('load', function(){ checkReveals(1); });
  checkReveals(1);

  /* ---- Counters ---- */
  function animateCount(el){
    var target = parseFloat(el.getAttribute('data-count'));
    var dec = (el.getAttribute('data-dec')==='1');
    function fmt(v){ return dec ? v.toFixed(1).replace('.',',') : Math.floor(v).toLocaleString('pt-BR'); }
    if(HIDDEN || matchMedia('(prefers-reduced-motion: reduce)').matches){ el.textContent = fmt(target); return; }
    var dur = 1800, start = null;
    function step(ts){
      if(!start) start = ts;
      var p = Math.min((ts-start)/dur, 1);
      var eased = 1 - Math.pow(1-p, 3);
      var val = target * eased;
      el.textContent = dec ? val.toFixed(1).replace('.',',') : Math.floor(val).toLocaleString('pt-BR');
      if(p < 1) requestAnimationFrame(step);
      else el.textContent = dec ? target.toFixed(1).replace('.',',') : target.toLocaleString('pt-BR');
    }
    requestAnimationFrame(step);
  }
  var counters = Array.prototype.slice.call(document.querySelectorAll('[data-count]'));
  function checkCounters(){
    for(var i = counters.length - 1; i >= 0; i--){
      if(inView(counters[i], 0.92)){ animateCount(counters[i]); counters.splice(i, 1); }
    }
  }
  if(HIDDEN){
    counters.forEach(function(el){ animateCount(el); });
    counters = [];
  } else {
    window.addEventListener('scroll', checkCounters, {passive:true});
    window.addEventListener('load', checkCounters);
    checkCounters();
  }

  /* ---- FAQ accordion ---- */
  document.querySelectorAll('.faq-item').forEach(function(item){
    var q = item.querySelector('.faq-q');
    var a = item.querySelector('.faq-a');
    if(!q || !a) return;
    q.addEventListener('click', function(){
      var open = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function(other){
        if(other!==item){ other.classList.remove('open'); var oa=other.querySelector('.faq-a'); if(oa) oa.style.maxHeight=null; }
      });
      if(open){ item.classList.remove('open'); a.style.maxHeight=null; }
      else { item.classList.add('open'); a.style.maxHeight = a.scrollHeight + 'px'; }
    });
  });

  /* ---- Lightbox ---- */
  var lb = document.querySelector('.lightbox');
  if(lb){
    var lbImg = lb.querySelector('img');
    document.querySelectorAll('[data-lightbox]').forEach(function(el){
      el.addEventListener('click', function(){
        var src = el.getAttribute('data-lightbox') || (el.querySelector('img') && el.querySelector('img').src);
        if(src){ lbImg.src = src; lb.classList.add('open'); document.body.style.overflow='hidden'; }
      });
    });
    function closeLb(){ lb.classList.remove('open'); document.body.style.overflow=''; }
    lb.addEventListener('click', function(e){ if(e.target===lb || e.target.classList.contains('x')) closeLb(); });
    document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeLb(); });
  }

  /* ---- Hero parallax (leve) ---- */
  var heroBg = document.querySelector('.hero .bg');
  if(heroBg && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    window.addEventListener('scroll', function(){
      var y = window.scrollY;
      if(y < window.innerHeight) heroBg.style.transform = 'translateY(' + (y*0.18) + 'px) scale(1.06)';
    }, {passive:true});
  }

  /* ---- Ano no rodapé ---- */
  var yr = document.querySelector('[data-year]');
  if(yr) yr.textContent = new Date().getFullYear();


})();
