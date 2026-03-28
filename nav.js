function toggleNav() {
    document.getElementById('navDropdown').classList.toggle('open');
}

document.addEventListener('click', function (e) {
    const btn = document.getElementById('hamburgerBtn');
    const dropdown = document.getElementById('navDropdown');
    if (dropdown.classList.contains('open') && !btn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
    }
});
