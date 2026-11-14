/* Dropdown menus in the header: hover on a mouse, tap on a touch screen,
   Esc or a click elsewhere closes them. */
(function(){
  var dds = document.querySelectorAll('.kdh-dd');
  if(!dds.length) return;
  var hover = window.matchMedia('(hover: hover)').matches;
  function close(except){
    for(var i=0;i<dds.length;i++){ if(dds[i]!==except){ dds[i].classList.remove('open'); dds[i].querySelector('button').setAttribute('aria-expanded','false'); } }
  }
  for(var i=0;i<dds.length;i++){(function(dd){
    var btn = dd.querySelector('button'), t;
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var on = !dd.classList.contains('open'); close(dd);
      dd.classList.toggle('open', on); btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    });
    if(hover){
      dd.addEventListener('mouseenter', function(){ clearTimeout(t); close(dd); dd.classList.add('open'); btn.setAttribute('aria-expanded','true'); });
      dd.addEventListener('mouseleave', function(){ t = setTimeout(function(){ dd.classList.remove('open'); btn.setAttribute('aria-expanded','false'); }, 180); });
    }
  })(dds[i]);}
  document.addEventListener('click', function(e){ if(!e.target.closest('.kdh-panel')) close(null); });
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') close(null); });
})();
