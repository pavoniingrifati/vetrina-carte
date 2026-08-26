(function(){
  const params = new URLSearchParams(location.search);
  const mode = params.get('mode') === 'gotham' ? 'gotham' : 'fantaballa';
  window.FUTTU_MODE = mode;
  document.write('<script src="config/' + mode + '.js?v=20260826-worldcup-v2"></' + 'script>');
})();
