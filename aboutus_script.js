// Scroll fade-in animation
const faders = document.querySelectorAll(".fade-in");

const appearOptions = {
  threshold: 0.2,
  rootMargin: "0px 0px -50px 0px"
};

const appearOnScroll = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("visible");
    observer.unobserve(entry.target);
  });
}, appearOptions);

faders.forEach(fader => appearOnScroll.observe(fader));

window.addEventListener('scroll', () => {
document.querySelectorAll('.fade-in').forEach(el => {
const rect = el.getBoundingClientRect();
if (rect.top < window.innerHeight - 100) {
el.classList.add('visible');
}
});
});


$(function(){
    zoom = $('.feature').css('background-size')
    zoom = parseFloat(zoom)/100
    size = zoom * $('.feature').width();
    $(window).on('scroll', function(){
      fromTop = $(window).scrollTop();
      newSize = size - (fromTop/3);
      if (newSize > $('.feature').width()) {
          $('.feature').css({
              '-webkit-background-size': newSize,
              '-moz-background-size': newSize,
              '-o-background-size': newSize,
              'background-size': newSize,
              '-webkit-filter':'blur('+ 0 + (fromTop/100) + 'px)',
              'opacity': 1 - ((fromTop / $('html').height()) * 1.3)
          });
      }
    });
});

