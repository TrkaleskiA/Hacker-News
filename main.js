document.addEventListener('DOMContentLoaded', function() {
    const navDivs = document.querySelectorAll('.custom-list .custom-list-div');
    const navItems = document.querySelectorAll('.nav-item .nav-link');
    const searchInput = document.getElementById('searchInput');
    const filterSelect = document.getElementById('filterSelect');
    const resultsCount = document.querySelector('.results p');

    let storyIds = [];
    let currentPage = 0;
    const storiesPerPage = 20;
    let currentSort = 'date';
    let currentTimePeriod = 'forever';
    let currentFilter = 'all'; // Default to 'all'
    let currentSearchText = '';
    let isLoading = false;
    let starredStories = JSON.parse(localStorage.getItem('starredStories')) || {};

    // Initial fetch of stories sorted by date
    fetchTopStories(currentSort, currentTimePeriod, currentFilter);

    navDivs.forEach(div => {
        div.addEventListener('click', function() {
            const filterType = this.id;

            navDivs.forEach(div => div.classList.remove('active'));
            this.classList.add('active');

            currentFilter = filterType;
            currentPage = 0; // Reset to the first page
            fetchTopStories(currentSort, currentTimePeriod, currentFilter);

            // Enable or disable the dropdown based on the filter type
            if (filterType === 'all' || filterType === 'starred') {
                filterSelect.disabled = false;
                filterSelect.classList.remove('disabled-option');
                filterSelect.value = 'all';
            } else {
                filterSelect.disabled = true;
                filterSelect.classList.add('disabled-option');
                filterSelect.value = 'all';
                currentFilterType = 'all';
                fetchTopStories(currentSort, currentTimePeriod, currentFilter);
            }
        });
    });

    navItems.forEach(navLink => {
        navLink.addEventListener('click', function(event) {
            event.preventDefault();
            navItems.forEach(link => link.classList.remove('active'));
            event.target.classList.add('active');

            currentSort = event.target.id === 'sort-by-date' ? 'date' : 'popularity';
            currentPage = 0; // Reset to the first page
            fetchTopStories(currentSort, currentTimePeriod, currentFilter);
        });
    });

    document.querySelectorAll('input[name="time-period"]').forEach(radio => {
        radio.addEventListener('change', function() {
            currentTimePeriod = getSelectedTimePeriod();
            currentPage = 0; // Reset to the first page
            fetchTopStories(currentSort, currentTimePeriod, currentFilter);
        });
    });

    searchInput.addEventListener('input', function() {
        currentSearchText = this.value.trim().toLowerCase();
        if (currentSearchText.length >= 2) {
            currentPage = 0;
            fetchTopStories(currentSort, currentTimePeriod, currentFilter);
        }
    });

    filterSelect.addEventListener('change', handleFilterChange);

    window.addEventListener('scroll', () => {
        if ((window.innerHeight + window.scrollY) / document.querySelector('.list-all').scrollHeight >= 0.6 && !isLoading) {
            currentPage++;
            const start = currentPage * storiesPerPage;
            const end = start + storiesPerPage;
            const paginatedStoryIds = storyIds.slice(start, end);
            loadStories(paginatedStoryIds, currentSort, currentTimePeriod);
        }
    });

    async function getStoryDetails(storyId) {
        try {
            const response = await fetch(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json?print=pretty`);
            return await response.json();
        } catch (error) {
            console.error(`Error fetching story ${storyId}:`, error);
        }
    }

    async function fetchTopStories(sortBy, timePeriod, filterType) {
        const startTime = performance.now()
        if (filterType === 'starred') {
            storyIds = Object.keys(starredStories); // Get the list of starred story IDs
            currentPage = 0; // Reset to the first page
            const paginatedStoryIds = storyIds.slice(0, storiesPerPage); // Paginate the list
            loadStories(paginatedStoryIds, sortBy, timePeriod); // Load the stories

            const endTime = performance.now(); // End timing
            const duration = ((endTime - startTime) / 1000).toFixed(4); // Calculate duration in seconds
            resultsCount.textContent = `${storyIds.length} results (${duration} seconds)`;
            return; // Exit the function early for 'starred' filter
        }

        let apiUrl = 'https://hacker-news.firebaseio.com/v0/topstories.json?print=pretty';

        if (filterType === 'hot') {
            apiUrl = 'https://hacker-news.firebaseio.com/v0/newstories.json?print=pretty';
        } else if (filterType === 'show-hn') {
            apiUrl = 'https://hacker-news.firebaseio.com/v0/showstories.json?print=pretty';
        } else if (filterType === 'ask-hn') {
            apiUrl = 'https://hacker-news.firebaseio.com/v0/askstories.json?print=pretty';
        } else if (filterType === 'poll') {
            apiUrl = 'https://hacker-news.firebaseio.com/v0/pollstories.json?print=pretty';
        } else if (filterType === 'job') {
            apiUrl = 'https://hacker-news.firebaseio.com/v0/jobstories.json?print=pretty';
        }

        try {

            const response = await fetch(apiUrl);
            storyIds = await response.json(); // Fetch story IDs based on the filter
            currentPage = 0; // Reset to the first page
            if (storyIds.length === 0) {
                renderNoStoriesMessage();
            }
            else{
                const paginatedStoryIds = storyIds.slice(0, storiesPerPage); // Paginate the list
                loadStories(paginatedStoryIds, sortBy, timePeriod); // Load the stories
            }
            const endTime = performance.now(); // End timing
            const duration = ((endTime - startTime) / 1000).toFixed(4)
            resultsCount.textContent = `${storyIds.length} results (${duration} seconds)`;
        } catch (error) {
            console.error('Error fetching stories:', error);
            renderNoStoriesMessage()
        }
    }

    async function loadStories(storyIds, sortBy, timePeriod) {
        isLoading = true;

        // Fetch the story details for the given storyIds
        const storyPromises = storyIds.map(storyId => getStoryDetails(storyId));
        const stories = await Promise.all(storyPromises);

        // Filter and sort stories
        const filteredStories = filterAndSortStories(stories, sortBy, timePeriod);
        renderStories(filteredStories);
        isLoading = false;

        // Reattach star click listeners after rendering
        addStarEventListeners(); // Reattach the star event listeners
    }

    function filterAndSortStories(stories, sortBy, timePeriod) {
        const now = new Date();
        let filteredStories = stories.filter(storyData => {
            const storyDate = new Date(storyData.time * 1000);
            const timeDiff = now - storyDate; // Difference in milliseconds
            const titleMatches = storyData.title.toLowerCase().includes(currentSearchText);
            const authorMatches = storyData.by.toLowerCase().includes(currentSearchText);
            const urlMatches = storyData.url ? storyData.url.toLowerCase().includes(currentSearchText) : false;
            const searchMatches = titleMatches || authorMatches || urlMatches;

            let timePeriodMatches = true;
            switch (timePeriod) {
                case 'last-24h':
                    timePeriodMatches = timeDiff < 24 * 60 * 60 * 1000;
                    break;
                case 'past-week':
                    timePeriodMatches = timeDiff < 7 * 24 * 60 * 60 * 1000;
                    break;
                case 'past-month':
                    timePeriodMatches = timeDiff < 30 * 24 * 60 * 60 * 1000;
                    break;
                case 'forever':
                    timePeriodMatches = true;
                    break;
            }
            return searchMatches && timePeriodMatches;
        });

        // Apply dropdown filter
        if (currentFilter === 'all' || currentFilter === 'starred') {
            const filterType = filterSelect.value;
            filteredStories = filteredStories.filter(storyData => {
                if (filterType === 'story') {
                    return storyData.type === 'story' || storyData.type === 'show-hn' || storyData.type === 'ask-hn';
                } else if (filterType === 'comment') {
                    return storyData.type === 'comment';
                } else if (filterType === 'poll') {
                    return storyData.type === 'poll';
                } else if (filterType === 'job') {
                    return storyData.type === 'job';
                } else if (filterType === 'show-hn') {
                    return storyData.title.startsWith('Show HN:');
                } else if (filterType === 'ask-hn') {
                    return storyData.title.startsWith('Ask HN:');
                }
                return true;
            });
        }

        // Sort stories
        if (sortBy === 'date') {
            filteredStories.sort((a, b) => b.time - a.time); // Sort by most recent first
        } else if (sortBy === 'popularity') {
            filteredStories.sort((a, b) => b.score - a.score); // Sort by highest score
        }

        return filteredStories;
    }

    async function getCommentDetails(commentId) {
        try {
            const response = await fetch(`https://hacker-news.firebaseio.com/v0/item/${commentId}.json?print=pretty`);
            return await response.json();
        } catch (error) {
            console.error(`Error fetching comment ${commentId}:`, error);
        }
    }

// Function to render a comment and its replies
    function renderComment(commentData, depth = 0) {
        const timeAgo = formatTime(commentData.time);
        const repliesContainerId = `replies-${commentData.id}`;

        let commentHtml = `
        <div class="comment" data-id="${commentData.id}" style="margin-left: ${depth * 20}px; border-left: 1px lightgray solid; border-bottom: 1px #f8f6f6 solid">
            <div class="comment-header">
                <span class="comment-author">${commentData.by}</span>
                <span class="comment-time">${timeAgo}</span>
            </div>
            <div class="comment-text">${commentData.text}</div>
            <div class="comment-actions">
                ${commentData.kids ? `<span class="replies-btn" data-id="${commentData.id}" data-depth="${depth}">Show Replies (${commentData.kids.length})</span>` : ''}
            </div>
            <div id="${repliesContainerId}" class="replies-container" style="display: none;"></div>
        </div>
    `;
        return commentHtml;
    }

// Function to load and render comments recursively
    async function loadComments(commentIds, container, depth = 0) {
        for (let commentId of commentIds) {
            const commentData = await getCommentDetails(commentId);
            const commentHtml = renderComment(commentData, depth);
            container.innerHTML += commentHtml;
        }
        addRepliesEventListeners();
    }

// Function to handle the show replies button click
    async function handleRepliesClick(event) {
        const button = event.target;
        const commentId = button.dataset.id;
        const depth = parseInt(button.dataset.depth) + 1;
        const repliesContainer = document.getElementById(`replies-${commentId}`);

        if (repliesContainer.style.display === 'none') {
            const commentData = await getCommentDetails(commentId);
            if (commentData.kids && repliesContainer.innerHTML === '') {
                await loadComments(commentData.kids, repliesContainer, depth);
            }
            repliesContainer.style.display = 'block';
            button.textContent = `Hide Replies`;
        } else {
            repliesContainer.style.display = 'none';
            let commentData = await getCommentDetails(commentId);
            button.textContent = `Show Replies (${commentData.kids.length})`;
        }
    }

    function addRepliesEventListeners() {
        document.querySelectorAll('.replies-btn').forEach(button => {
            button.onclick = handleRepliesClick;
        });
    }

// Modify the renderStories function to include comment button
    function renderStories(stories) {
        const listAll = document.querySelector('.list-all');
        if (currentPage === 0) {
            listAll.innerHTML = ''; // Clear the list if it's the first page
        }

        stories.forEach(storyData => {
            const timeAgo = formatTime(storyData.time);
            const isStarred = starredStories[storyData.id] ? 'starred' : '';

            const storyHtml =
                `
            <div class="story d-flex flex-column mb-1" data-id="${storyData.id}">
                <div class="d-flex align-items-start bg-white p-3">
                    <img class="story-img me-3" src="photos/all.png" alt="Story Image">
                    <div>
                        <p style="margin: 0;">${storyData.title}</p>
                        <div class="post-details" style="color: gray; font-size: 0.9em;">
                            <span class="heart" data-id="${storyData.id}">
                                <img src="photos/heart.png" style="width: 15px; vertical-align: middle; margin-right: 5px;">
                                <span class="points">${storyData.score}</span> points
                            </span> |
                            <span><img src="photos/user.png" style="width: 15px; vertical-align: middle; margin-right: 5px;">${storyData.by}</span> |
                            <span><img src="photos/clock.png" style="width: 15px; vertical-align: middle; margin-right: 5px;">${timeAgo}</span> |
                            <a class="story-url" target="_blank" href="${storyData.url}"><span>${storyData.url ? new URL(storyData.url).hostname : ''}</span></a>
                            <span>${storyData.type}</span>
                        </div>
                    </div>
                    <div class="comment-section ms-auto d-flex align-items-center">
                        <div style="display: inline" class="comment-btn" data-id="${storyData.id}">
                            <img class="chat" src="photos/chat.png" alt="Chat">
                            <p style="display: inline" class="comment-button mb-0">${storyData.descendants || 0} comments</p>
                        </div>
                        
                        <img class="share ms-2" src="photos/share.png" alt="Share">
                        <img class="star ms-2 ${isStarred}" src="photos/star.png" alt="Star">
                    </div>
                </div>
                <div class="comments-container bg-white" style="display: none;"></div>
            </div>
        `;
            listAll.innerHTML += storyHtml;
        });

        addHeartEventListeners();
        addStarEventListeners();
        addCommentEventListeners(); // Attach comment click listeners
    }

    function addCommentEventListeners() {
        document.querySelectorAll('.comment-btn').forEach(button => {
            button.onclick = async function() {
                const storyId = this.dataset.id;
                const storyElement = this.closest('.story');
                const commentsContainer = storyElement.querySelector('.comments-container');

                if (commentsContainer.style.display === 'none') {
                    if (commentsContainer.innerHTML === '') {
                        const storyData = await getStoryDetails(storyId);
                        if (storyData.kids) {
                            await loadComments(storyData.kids, commentsContainer);
                        }
                    }
                    commentsContainer.style.display = 'block';
                } else {
                    commentsContainer.style.display = 'none';
                }
            }
        });
    }

    function addStarEventListeners() {
        document.querySelectorAll('.star').forEach(star => {
            star.onclick = () => toggleStar(star);
        });
    }

    function toggleStar(star) {
        const storyId = star.closest('.story').dataset.id;
        if (!storyId) return;

        if (starredStories[storyId]) {
            delete starredStories[storyId];
            star.classList.remove('starred');
        } else {
            starredStories[storyId] = true;
            star.classList.add('starred');
        }

        localStorage.setItem('starredStories', JSON.stringify(starredStories));
    }

    function addHeartEventListeners() {
        document.querySelectorAll('.heart').forEach(heart => {
            heart.onclick = () => toggleHeart(heart);
        });
    }

    function toggleHeart(heart) {
        const storyId = heart.dataset.id;
        const pointsSpan = heart.querySelector('.points');
        const points = parseInt(pointsSpan.textContent, 10);

        if (heart.classList.contains('active')) {
            // Remove the heart and decrement the points
            heart.classList.remove('active');
            pointsSpan.textContent = points - 1;
            // Update the points in the backend if needed
        } else {
            // Add the heart and increment the points
            heart.classList.add('active');
            pointsSpan.textContent = points + 1;
            // Update the points in the backend if needed
        }
    }

    function handleFilterChange() {
        currentFilterType = filterSelect.value;
        fetchTopStories(currentSort, currentTimePeriod, currentFilter);
    }

    function renderNoStoriesMessage() {
        const listAll = document.querySelector('.list-all');
        resultsCount.textContent = `0 results (0 seconds)`
        listAll.innerHTML = `<p class="text-center mt-5">No ${currentFilter}s  available for this category.</p>`;
    }

    function getSelectedTimePeriod() {
        return document.querySelector('input[name="time-period"]:checked').value;
    }

    function formatTime(timestamp) {
        const now = new Date();
        const then = new Date(timestamp * 1000);
        let diff = Math.floor((now - then) / 1000);
        const units = [
            { label: 'second', value: 60 },
            { label: 'minute', value: 60 },
            { label: 'hour', value: 24 },
            { label: 'day', value: 30 },
            { label: 'month', value: 12 },
            { label: 'year', value: Number.MAX_SAFE_INTEGER }
        ];

        for (let i = 0; i < units.length; i++) {
            if (diff < units[i].value) {
                return `${Math.floor(diff)} ${units[i].label}${Math.floor(diff) !== 1 ? 's' : ''} ago`;
            }
            diff /= units[i].value;
        }
    }
});
