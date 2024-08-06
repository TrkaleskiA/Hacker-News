document.addEventListener('DOMContentLoaded', function() {
    const elements = {
        navDivs: '.custom-list .custom-list-div',
        navItems: '.nav-item .nav-link',
        searchInput: '#searchInput',
        filterSelect: '#filterSelect',
        resultsCount: '.results p'
    };

    HackerNewsModule().init(elements);
});
