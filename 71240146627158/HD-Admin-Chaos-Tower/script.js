// script.js
tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                'roblox-dark': '#191B1D',
                'roblox-dark-secondary': '#232527',
                'roblox-blue': '#00A2FF',
            }
        }
    }
}

let currentSlide = 0;
function changeSlide(direction) {
    const wrapper = document.getElementById('sliderWrapper');
    const totalSlides = wrapper.children.length;
    currentSlide = (currentSlide + direction + totalSlides) % totalSlides;
    wrapper.style.transform = `translateX(-${currentSlide * 100}%)`;
}

// Добавьте сюда логику переключения темы и языка, если она у вас была
