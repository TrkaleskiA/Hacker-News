const HackerNewsModule = () => {
    const returnObj = {}
    const api= 'https://hacker-news.firebaseio.com/v0';
    returnObj.init = (elements) => {
        const navDivs = document.querySelectorAll(elements.navDivs);
        const navItems = document.querySelectorAll(elements.navItems);
        const searchInput = document.querySelector(elements.searchInput);
        const filterSelect = document.querySelector(elements.filterSelect);
        const resultsCount = document.querySelector(elements.resultsCount);

        /*const navDivs = document.querySelectorAll('.custom-list .custom-list-div');
        const navItems = document.querySelectorAll('.nav-item .nav-link');
        const searchInput = document.getElementById('searchInput');
        const filterSelect = document.getElementById('filterSelect');
        const resultsCount = document.querySelector('.results p');*/

        let storyIds = [];
        let currentPage = 0;
        let storiesPerPage = 20;
        let currentSort = 'date';
        let currentTimePeriod = 'forever';
        let currentFilter = 'all'; // Default to 'all'
        let currentSearchText = '';
        let search = false;
        let isLoading = false;
        let starredStories = JSON.parse(localStorage.getItem('starredStories')) || {};

        let stopFetching = false;
        let currentFetchTask = null;
        async function handleFetchTask(fetchTopStories, currentSort, currentTimePeriod, currentFilter) {
            if (currentFetchTask) {
                stopFetching = true;
                await currentFetchTask;
            }
            stopFetching = false;
            currentFetchTask = fetchTopStories(currentSort, currentTimePeriod, currentFilter);
        }
        function getApiUrl(filterType) {
            switch (filterType) {

                case 'hot':
                    return `${api}/newstories.json?print=pretty`;
                case 'show-hn':
                    return `${api}/showstories.json?print=pretty`;
                case 'ask-hn':
                    return `${api}/askstories.json?print=pretty`;
                case 'poll':
                    return `${api}/pollstories.json?print=pretty`;
                case 'job':
                    return `${api}/jobstories.json?print=pretty`;
                case 'starred':
                    return ''; // No API URL for starred; it uses local storage
                default:
                    return `${api}/topstories.json?print=pretty`;
            }
        }


        handleFetchTask(fetchTopStories,currentSort, currentTimePeriod, currentFilter);
        if(navDivs){
            async function handleNavDivsClick(){
                const filterType = this.id;

                navDivs.forEach(div => div.classList.remove('active'));
                this.classList.add('active');

                currentFilter = filterType;
                currentPage = 0; // Reset to the first page
                document.querySelector('.list-all').innerHTML = '';
                await handleFetchTask(fetchTopStories,currentSort, currentTimePeriod, currentFilter);

                if(filterSelect){
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
                    }
                }

            }

            navDivs.forEach(div => {
                div.addEventListener('click', handleNavDivsClick)});
        }

        if(navItems){
            async function handleNavItemClick() {
                const sortType = this.id;
                navItems.forEach(link => link.classList.remove('active'));
                this.classList.add('active');

                currentSort = sortType === 'sort-by-date' ? 'date' : 'popularity';
                currentPage = 0; // Reset to the first page
                document.querySelector('.list-all').innerHTML = '';
                await handleFetchTask(fetchTopStories, currentSort, currentTimePeriod, currentFilter);
            }

            navItems.forEach(navLink => {
                navLink.addEventListener('click', handleNavItemClick);
            });
        }


        document.querySelectorAll('input[name="time-period"]').forEach(radio => {
            radio.addEventListener('change', async function() {
                currentTimePeriod = getSelectedTimePeriod();
                currentPage = 0; // Reset to the first page
                await handleFetchTask(fetchTopStories,currentSort, currentTimePeriod, currentFilter);
            });
        });

        if(searchInput){
            let searchTimeout;
            searchInput.addEventListener('input', (event) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(async () => {
                    await handleSearch(event.target.value.trim().toLowerCase());
                }, 750); // 0.75 seconds debounce
            });
        }


// Function to handle search action
        async function handleSearch(searchText) {
            currentSearchText = searchText;
            if (currentSearchText.length >= 2) {
                currentPage = 0;
                search = true;
                await handleFetchTask(fetchTopStories, currentSort, currentTimePeriod, currentFilter);
            } else {
                currentPage = 0;
                search = false;
                document.querySelector('.list-all').innerHTML = '';
                await handleFetchTask(fetchTopStories, currentSort, currentTimePeriod, currentFilter);
            }
        }


        if(filterSelect)filterSelect.addEventListener('change', handleFilterChange);

        window.addEventListener('scroll', async () => {
            if ((window.innerHeight + window.scrollY) / document.querySelector('.list-all').scrollHeight >= 0.6 && !isLoading) {
                await handleScrolled();
            }
        });

        async function handleScrolled(){
            currentPage++;
            const start = currentPage * storiesPerPage;
            const end = start + storiesPerPage;
            let paginatedStoryIds = storyIds.slice(start, end);

            if (paginatedStoryIds.length > 0) {
                isLoading = true;
                await loadStories(paginatedStoryIds, currentSort, currentTimePeriod);
            }

        }


        async function getStoryDetails(storyId) {
            try {
                const response = await fetch(`${api}/item/${storyId}.json?print=pretty`);
                return await response.json();
            } catch (error) {
                console.error(`Error fetching story ${storyId}:`, error);
            }
        }


        async function fetchTopStories(sortBy, timePeriod, filterType) {
            const startTime = performance.now();
            if (filterType === 'starred') {
                await fetchStarredStories(sortBy,timePeriod,startTime);
                return;
            }

            let apiUrl = getApiUrl(filterType);

            try {
                const response = await fetch(apiUrl);
                storyIds = await response.json();

                if (filterType !== 'hot') {
                    storyIds.sort((a, b) => b - a);
                }

                currentPage = 0;

                // Clear previous stories
                document.querySelector('.list-all').innerHTML = '';

                if (storyIds.length === 0) {
                    renderNoStoriesMessage();
                }
                else {
                    await loadSearchedStories(sortBy,timePeriod);
                }



                const endTime = performance.now(); // End timing
                const duration = ((endTime - startTime) / 1000).toFixed(4)
                if(resultsCount)resultsCount.textContent = `${storyIds.length} results (${duration} seconds)`;
            } catch (error) {
                console.error('Error fetching stories:', error);
                renderNoStoriesMessage();
            }
        }

        async function fetchStarredStories(sortBy,timePeriod,startTime){
            // Sort starred stories by ID in descending order
            storyIds = Object.keys(starredStories).sort((a, b) => b - a);

            currentPage = 0;
            document.querySelector('.list-all').innerHTML = '';
            const paginatedStoryIds = storyIds.slice(0, storiesPerPage);
            await loadStories(paginatedStoryIds, sortBy, timePeriod);

            const endTime = performance.now();
            const duration = ((endTime - startTime) / 1000).toFixed(4); // Calculate duration in seconds
            if(resultsCount)resultsCount.textContent = `${storyIds.length} results (${duration} seconds)`;
        }
        async function loadSearchedStories(sortBy,timePeriod) {
            if (!search) {
                let paginatedStoryIds = storyIds.slice(0, storiesPerPage);//Search should not go inside this (It get limited to first 20 Ids) Fixes: storiesPerPage special case changed to max, or when searching don't go inside this if else
                await loadStories(paginatedStoryIds, sortBy, timePeriod);
            } else {
                let paginatedStoryIds = storyIds.slice(0, 150)
                await loadStories(paginatedStoryIds, sortBy, timePeriod);
            }
        }


        // async function fetchStoryIds(sortBy, timePeriod, filterType, start, end) {
        //     if(filterType === 'starred'){
        //         return storyIds.slice(start, end);
        //     }
        //     const fetchIds = async () => {
        //         let apiUrl = getApiUrl(filterType);
        //
        //         try {
        //             const response = await fetch(apiUrl);
        //             const storyIds = await response.json();
        //
        //
        //             if (filterType !== 'hot') {
        //                 storyIds.sort((a, b) => b - a);
        //             }
        //
        //             return storyIds.slice(start, end);
        //         } catch (error) {
        //             console.error('Error fetching story IDs:', error);
        //         }
        //     };
        //
        //     return fetchIds();
        // }




        async function loadStories(storyIds, sortBy, timePeriod) {
            isLoading = true;

            for (let i = 0; i < storyIds.length; i++) {
                if (stopFetching) break;
                const storyId = storyIds[i];
                const storyData = await getStoryDetails(storyId);
                if (storyData) {
                    const filteredStories = filterAndSortStories([storyData], sortBy, timePeriod);
                    renderStories(filteredStories, sortBy);
                    addHeartEventListeners();
                    addStarEventListeners();
                    addCommentEventListeners();
                }
            }

            isLoading = false;
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
                checkTimePeriodFilter(timePeriod,timePeriodMatches,timeDiff)
                return searchMatches && timePeriodMatches;
            });

            // Apply dropdown filter
            if (filterSelect){
                if (currentFilter === 'all' || currentFilter === 'starred') {
                    filteredStories = checkDropdownFilter(filterSelect.value,filteredStories)
                }
            }


            // Sort stories
            if (sortBy === 'date') {
                filteredStories.sort((a, b) => b.time - a.time); // Sort by most recent first
            } else if (sortBy === 'popularity') {
                filteredStories.sort((a, b) => b.score - a.score); // Sort by highest score
            }

            return filteredStories;
        }

        function checkTimePeriodFilter(timePeriod,timePeriodMatches,timeDiff){
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
        }
        function checkDropdownFilter(filterType, stories) {
            return stories.filter(storyData => {
                switch (filterType) {
                    case 'story':
                        return storyData.type === 'story' || storyData.type === 'show-hn' || storyData.type === 'ask-hn';
                    case 'comment':
                        return storyData.type === 'comment';
                    case 'poll':
                        return storyData.type === 'poll';
                    case 'job':
                        return storyData.type === 'job';
                    case 'show-hn':
                        return storyData.title.startsWith('Show HN:');
                    case 'ask-hn':
                        return storyData.title.startsWith('Ask HN:');
                    default:
                        return true;
                }
            });
        }
        async function getCommentDetails(commentId) {
            try {
                console.log("getComment")
                const response = await fetch(`${api}/item/${commentId}.json?print=pretty`);
                return await response.json();
            } catch (error) {
                console.error(`Error fetching comment ${commentId}:`, error);
            }
        }

        function renderComment(commentData, depth = 0) {
            const timeAgo = formatTime(commentData.time);
            const repliesContainerId = `replies-${commentData.id}`;

            return `
        <div class="comment" data-id="${commentData.id}" style="margin-left: ${depth * 20}px; border-left: 1px lightgray solid; border-bottom: 1px #f8f6f6 solid">
            <div class="comment-header">
                <span class="comment-author">${commentData.by}</span>
                <span class="comment-time">${timeAgo}</span>
            </div>
            <div class="comment-text">${commentData.text}</div>
            <div class="comment-actions">
                ${commentData.kids ? `<span class="replies-btn" data-id="${commentData.id}" data-depth="${depth}">Show Replies (${commentData.kids.length})</span>` : ''}
            </div>
            <div id="${repliesContainerId}" class="replies-container" style="display: block;"></div>
        </div>
    `;
        }


        async function loadComments(commentIds, container, depth = 0) {
            for (let commentId of commentIds) {
                const commentData = await getCommentDetails(commentId);
                const commentHtml = renderComment(commentData, depth);
                container.innerHTML += commentHtml
                console.log("give event")
                addRepliesEventListeners();
            }

        }


        async function handleRepliesClick(event) {
            console.log("reply clicked")
            const button = event.target;
            const commentId = button.dataset.id;
            const depth = parseInt(button.dataset.depth) + 1;
            const repliesContainer = document.getElementById(`replies-${commentId}`);
            await displayReplies(button,commentId,depth,repliesContainer)

        }
        async function displayReplies(button,commentId,depth,repliesContainer){
            if (repliesContainer.style.display === 'block')  {
                const commentData = await getCommentDetails(commentId);
                if (commentData.kids && repliesContainer.innerHTML === '') {        //Can be simpler check if elses
                    button.textContent = `Hide Replies`;
                    await loadComments(commentData.kids, repliesContainer, depth);

                }
                else{
                    repliesContainer.style.display = 'none';
                    button.textContent = `Show Replies (${commentData.kids.length})`;
                }


            } else {
                repliesContainer.style.display = 'block';
                await getCommentDetails(commentId);
                button.textContent = `Hide Replies`;
            }
        }


        function addRepliesEventListeners() {
            document.querySelectorAll('.replies-btn').forEach(button => {
                button.onclick = handleRepliesClick;
            });
        }


        function renderStories(stories, sortBy) {
            const listAll = document.querySelector('.list-all');

            stories.forEach(storyData => {
                const timeAgo = formatTime(storyData.time);
                const isStarred = starredStories[storyData.id] ? 'starred' : '';

                const storyHtml =
                    `
        <div class="story d-flex flex-column mb-1" data-id="${storyData.id}" data-score="${storyData.score+storyData.descendants}">
            <div class="d-flex align-items-start bg-white p-3">
                <img class="story-img me-3" src="photos/all.png" alt="Story Image">
                <div>
                    <p style="margin: 0;">${storyData.title}</p>
                    <div class="post-details" style="color: gray; font-size: 0.9em;">
                        <span class="heart" data-id="${storyData.id}">
                            <img src="photos/heart.png" style="width: 15px; vertical-align: middle; margin-right: 5px;" alt="Heart">
                            <span class="points">${storyData.score}</span> points
                        </span> |
                        <span><img src="photos/user.png" style="width: 15px; vertical-align: middle; margin-right: 5px;" alt="User">${storyData.by}</span> |
                        <span><img src="photos/clock.png" style="width: 15px; vertical-align: middle; margin-right: 5px;" alt="Clock">${timeAgo}</span> |
                        <a class="story-url" target="_blank" href="${storyData.url}"><span>${storyData.url ? new URL(storyData.url).hostname : ''}</span></a>
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
            <div class="comments-container bg-white" style="display: block;"></div>
        </div>
    `;

                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = storyHtml.trim();
                const newStoryElement = tempDiv.firstChild;

                if (sortBy === 'popularity') {
                    // Add the new story to the appropriate position based on score
                    let inserted = false;
                    const existingStories = Array.from(listAll.children);
                    for (let i = 0; i < existingStories.length; i++) {
                        const existingStoryScore = parseInt(existingStories[i].dataset.score, 10);
                        if (storyData.score + storyData.descendants > existingStoryScore) {
                            listAll.insertBefore(newStoryElement, existingStories[i]);
                            inserted = true;
                            break;
                        }
                    }
                    if (!inserted) {
                        listAll.appendChild(newStoryElement);
                    }
                } else {
                    listAll.appendChild(newStoryElement);
                }
            });

            addHeartEventListeners();
            addStarEventListeners();
            addCommentEventListeners();
        }


        function addCommentEventListeners() {
            document.querySelectorAll('.comment-btn').forEach(button => {
                button.onclick = async function() {
                    const storyId = this.dataset.id;
                    const storyElement = this.closest('.story');
                    const commentsContainer = storyElement.querySelector('.comments-container');

                    if (commentsContainer.style.display === 'block') {
                        if (commentsContainer.innerHTML === '') {
                            const storyData = await getStoryDetails(storyId);
                            if (storyData.kids) {
                                await loadComments(storyData.kids, commentsContainer);
                            }
                        }
                        else{
                            commentsContainer.style.display = 'none';
                        }

                    }
                    else {
                        commentsContainer.style.display = 'block';
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
            const pointsSpan = heart.querySelector('.points');
            const points = parseInt(pointsSpan.textContent, 10);

            if (heart.classList.contains('active')) {
                heart.classList.remove('active');
                pointsSpan.textContent = points - 1;

            } else {
                heart.classList.add('active');
                pointsSpan.textContent = points + 1;

            }
        }
        if(filterSelect){
            function handleFilterChange() {
                currentFilterType = filterSelect.value;
                currentPage = 0;
                fetchTopStories(currentSort, currentTimePeriod, currentFilter);
            }
        }


        function renderNoStoriesMessage() {
            const listAll = document.querySelector('.list-all');
            if(resultsCount)resultsCount.textContent = `0 results (0 seconds)`
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

    }
    return returnObj;
}