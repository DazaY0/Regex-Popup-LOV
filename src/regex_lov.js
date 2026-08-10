var regexLov = {
    currentDropdown: null,

    init: function(itemId, ajaxId, displayNull, nullValue, nullText, isReadOnly,  isCreateNewButton, createNewPageURL) {
        var $display = $("#" + itemId + "_DISPLAY");
        var $hidden  = $("#" + itemId);
        var $btn     = $("#" + itemId + "_BTN");
        var $itemContainer = $display.closest('.t-Form-fieldContainer');
        var $wrapper = $display.closest('.apex-item-wrapper');

        // register apex item for Interactive Grid support
        apex.item.create(itemId, {
            getValue: function() {
                return $hidden.val();
            },
           setValue: function(value, displayValue) {
                $hidden.val(value);
                
                // 2. Handle the Visible Text
                if (displayValue) {
                    $display.val(displayValue);
                } else if (!value || value.length === 0) {
                    $display.val('');
                } else {
                    // We have an ID but NO display text.
                    // This happens when IG loads a row. We must update $display 
                    // otherwise it shows the text from the prevoius row!
                    // Fallback: show the ID so the user sees *something* changed.
                    $display.val(value); 
                }
            },
           enable: function() {
                // Enable the visible input and button
                $display.prop('disabled', false);
                $btn.prop('disabled', false);
                
                // Enable the hidden input so APEX can read/submit its value
                $hidden.prop('disabled', false);
                
                // Remove the standard APEX disabled class from the wrapper
                $wrapper.removeClass('apex-item-wrapper--is-disabled');
            },
            disable: function() {
                // Disable the inputs
                $display.prop('disabled', true);
                $btn.prop('disabled', true);
                $hidden.prop('disabled', true); 
                
                // Add the standard APEX disabled class for proper UI rendering
                $wrapper.addClass('apex-item-wrapper--is-disabled');
                
                // CRITICAL: Destroy the dropdown to prevent focus trapping and infinite loops
                regexLov.closeDropdown();
            },
            getPopupSelector: function() {
                return "#regex_dropdown_" + itemId;
            },

            // The grid needs to know what text to display 
            // when the cell is closed/not actively being edited.
            displayValueFor: function(value) {
                // Ideally, map the value from a local JS array
                // Otherwise, returning the current display value 
                return $display.val() || value; 
            },
            remove: function() {
                $(window).off("resize." + itemId);
                if (regexLov.currentDropdown && regexLov.currentDropdown.data('id') === itemId) {
                    regexLov.currentDropdown.remove();
                    regexLov.currentDropdown = null;
                    $(document).off('click.regexLov'); 
                }
            }
            
        });

        // initial state on load
        if ($display.val()) {
            $itemContainer.addClass('apex-item-wrapper--has-initial-value js-show-label');
        }

        // event handler
        var toggleHandler = function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (!$display.prop('disabled')) {
                if ($display.val() === nullText) {
                    $wrapper.addClass('apex-item-wrapper--has-initial-value');
                }
                // Pass nullText into the dropdown toggler
                regexLov.toggleDropdown(itemId, ajaxId, displayNull, nullValue, nullText,  isCreateNewButton, createNewPageURL);
            }
        };

        $btn.on("click", toggleHandler);
        $display.prop('readonly', true).on("click", toggleHandler);

        $(window).on("resize." + itemId, function() {
            regexLov.closeDropdown();
        });
    },

    toggleDropdown: function(itemId, ajaxId, displayNull, nullValue, nullText, isCreateNewButton, createNewPageURL) {
        if (regexLov.currentDropdown && regexLov.currentDropdown.data('id') === itemId) {
            regexLov.closeDropdown();
            return;
        }
        regexLov.closeDropdown();

        var $displayItem = $("#" + itemId + "_DISPLAY");
        
        // Look for standard containers, but fallback to the input itself for IG
        var $container = $displayItem.closest('.t-Form-inputContainer, .apex-item-wrapper');
        if ($container.length === 0) {
            $container = $displayItem; // Fallback for Interactive Grid
        }

        var $fieldContainer = $displayItem.closest('.t-Form-fieldContainer');
        if ($fieldContainer.length > 0) {
            $fieldContainer.addClass('is-active js-show-label');
        }

        var searchMode = 'SIMPLE';
        var cachedResults = [];
        var currentIndex = 0;
        var pageSize = 50;

        var showCreateNewButton =
        isCreateNewButton === true ||
        isCreateNewButton == "true" ||
        isCreateNewButton === "Y";

        var createButtonHtml = "";

        if (showCreateNewButton && createNewPageURL) {
            createButtonHtml = `
                <li class="lov-create-new-item">
                    <button
                        type="button"
                        class="lov-create-new-btn t-Button--hot open-details-btn"
                        data-dialog-url="${createNewPageURL}">
                          <span class="fa fa-plus" aria-hidden="true"></span>
                          <span>Create New</span>
                    </button>
                </li>`;
        }

      
        var content = `
            <div id="regex_dropdown_${itemId}" class="regex-lov-dropdown">
                <div class="lov-header">
                    <div class="lov-search-row">
                        <input type="text" id="lovSearch" class="apex-item-text lov-search-input"  autocomplete="off">
                        <button type="button" id="btnSearch" class="t-Button t-Button--icon t-Button--hot t-Button--small" title="Search">
                            <span class="fa fa-search" aria-hidden="true"></span>
                        </button>
                    </div>
                </div>
                
                <div id="lovFixedContainer" class="lov-fixed-container">
                    <ul class="lov-list" style="">
                        <li class="lov-item lov-null-item " style="font-style: italic;"></li>
                    </ul>
                </div>

                <div class="lov-scroll-container" >
                    <ul id="lovResults" class="lov-list">
                        <li class="lov-empty"><span class="fa fa-search" aria-hidden="true"></span><p>No results found</p></li>
                        ${createButtonHtml}
                    </ul>
                </div>
            </div>
        `;
        
        var $dropdown = $(content);
        $dropdown.data('id', itemId);
        $dropdown.data('fieldContainer', $fieldContainer); 

        //appends the div of the regex search to the bottom of the body
        //when activating it calculates the position of the Page item and sets the window there
        //this prevents a lot of content movement when activating it
        $('body').append($dropdown);
        regexLov.currentDropdown = $dropdown;

        var isDisplayNull = (displayNull === true || displayNull === 'true' || displayNull === 'Y');
        nullValue = nullValue || "";
        nullText  = nullText  || "null";
        //container for the nulltext that is now fixed and doesnt scroll
        console.log( "displaynull" + isDisplayNull);
        if (isDisplayNull) {
            $dropdown.find('.lov-null-item')
                .text(nullText)
                .on('mousedown', function(e) {
                    e.preventDefault();
                    apex.item(itemId).setValue(nullValue, nullText);
                    $("#" + itemId).trigger("change");
                    regexLov.closeDropdown();
                });
            $dropdown.find('#lovFixedContainer').show();
        } else {
            $dropdown.find('#lovFixedContainer').remove(); 
        }

        var offset = $container.offset();
        var height = $container.outerHeight();
        var width  = $container.outerWidth();
        
        $dropdown.css({
            "position": "absolute", 
            "top": (offset.top + height) + "px",
            "left": offset.left + "px",
            "width": width + "px",
            "min-width": "250px",
            "z-index": 2000 // this ensures that it floats above the IG headers and dialogs
        });

        var $searchInput = $dropdown.find("#lovSearch");
        setTimeout(function() { $searchInput.focus(); }, 50);

        //render of list
        function renderResults(append) {
            var $list = $dropdown.find("#lovResults");

            //append says if its the first time rendering
            if (!append) {
                $list.empty();
                currentIndex = 0;
            } else {
                // Remove the old load more button 
                $list.find('.lov-load-more-item').remove();
            }

            var endIndex = Math.min(currentIndex + pageSize, cachedResults.length); // if the cached results are smaller than the next page size
            var chunk = cachedResults.slice(currentIndex, endIndex);
            

            chunk.forEach(function(item) {
                var highlightedName = getHighlightedText(item.display_name, $searchInput.val());
                console.log(highlightedName)
                $("<li>")
                    .html(highlightedName) 
                    .addClass("lov-item")
                    .on("mousedown", function(e) { 
                        e.preventDefault();
                        apex.item(itemId).setValue(item.id, item.display_name); 
                        $("#" + itemId).trigger("change");
                        regexLov.closeDropdown();
                    })
                    .appendTo($list);
            });

            currentIndex = endIndex;

            // dynamically hangs on the load more button
            if (currentIndex < cachedResults.length) {
                $("<li>")
                    .text("show more")
                    .addClass("lov-item lov-load-more-item")
                    .on("mousedown", function(e) {
                        //mouse down instead of click because else it loses the focus and the closes itself
                        e.preventDefault(); 
                        e.stopPropagation();
                        renderResults(true); //dont render the list from the beginning
                    })
                    .appendTo($list);
            }
        }

        // AJAX Search
        function performSearch() {
            var val = $searchInput.val();
            var $list = $dropdown.find("#lovResults");
            
            //prevent blank searches for regex as that doesnt return anything
            if(searchMode === 'REGEX' && val === '') {
                 $list.html('<li class="lov-empty"><span class="fa fa-search" aria-hidden="true"></span><p>No results found</p></li>'+ createButtonHtml);
                 return;
            }

            $list.html('<li class="lov-loading"><span class="fa fa-spinner fa-anim-spin"></span> Searching...</li>');
            //console.log("starting search");
            apex.server.plugin(ajaxId, { 
                x01: val,
                x02: searchMode
            }, {
                success: function(data) {
                   // console.log("successfully got search");
                    if (!data.results || data.results.length === 0) {
                        $list.html('<li class="lov-empty"><span class="fa fa-search" aria-hidden="true"></span><p>No results found</p></li>'+ createButtonHtml);
                        cachedResults = [];
                    } else {
                        cachedResults = data.results;
                        renderResults(false); //first time so render the list from the beginning
                    }
                },
                error: function(xhr, status, error) {
                     $list.html('<li class="lov-empty" style="color:red; padding:10px;">Error: ' + error + '</li>');
                }
            });
        }

        //on click
        $dropdown.find("#btnSearch").on("click", function(e) {
            e.stopPropagation();
            performSearch();
        });

        //on enter
        $searchInput.on("keypress", function(e) {
            if(e.which === 13) { 
                e.preventDefault();
                performSearch();
            }
        });


        setTimeout(function() {
            // if the user clicks outside of the window close it
           $(document).on('mousedown.regexLov', function(e) {
                if (!$(e.target).closest('.regex-lov-dropdown').length && 
                    !$(e.target).closest('#' + itemId + '_BTN').length &&
                    !$(e.target).closest('#' + itemId + '_DISPLAY').length) {
                    regexLov.closeDropdown();
                }
            });

            // if the user presses esc while the regex window is open
            $(document).on('keydown.regexLov', function(e) {
                if (e.key === "Escape") {
                    regexLov.closeDropdown();
                    // return focus to the page item
                    $("#" + itemId + "_DISPLAY").focus(); 
                }
            });
        }, 10);
        performSearch() //start at init


        function getHighlightedText(text, searchStr) {
            // 1. Escape HTML to prevent XSS (since we inject HTML tags next)
            var escapeHTML = function(str) {
                var div = document.createElement('div');
                div.innerText = str;
                return div.innerHTML;
            };
            var safeText = escapeHTML(text || "");
            
            if (!searchStr) return safeText;

            // 2. Handle '\%' by temporarily swapping it with a placeholder (null character)
            var protectedSearch = searchStr.replace(/\\%/g, '\u0000');

            // 3. Split by the '%' wildcard and restore the escaped '%'
            var chunks = protectedSearch.split('%');
            chunks = chunks.map(function(chunk) {
                return chunk.replace(/\u0000/g, '%');
            }).filter(function(chunk) {
                return chunk.length > 0; // Remove empty tokens
            });

            if (chunks.length === 0) return safeText;

            // 4. Escape regex special characters in the chunks so they are matched literally
            var escapeRegExp = function(string) {
                return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            };
            var escapedChunks = chunks.map(escapeRegExp);

            // 5. Create a dynamic regex matching any of the chunks globally and case-insensitively
            // Example: (chunk1|chunk2)
            var regexPattern = new RegExp('(' + escapedChunks.join('|') + ')', 'gi');

            // 6. Wrap matches in strong tags
            return safeText.replace(regexPattern, '<strong>$1</strong>');
        }

        //button handler for create new
        $dropdown.on("click", ".open-details-btn", function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log("clicked on create new")

            var url = $(this).data("dialog-url");

            if (url) {
                apex.navigation.redirect(url);
            }
            regexLov.closeDropdown();
        });
    },

    closeDropdown: function() {
        if (this.currentDropdown) {
            var $fieldContainer = this.currentDropdown.data('fieldContainer');
            var itemId = this.currentDropdown.data('id');
            var $displayItem = $("#" + itemId + "_DISPLAY");
            var $wrapper = $displayItem.closest('.apex-item-wrapper');

            //chekc if display Value is not null if value is null
            if ($displayItem.val() && $displayItem.val().length > 0) {
                //keep the label floating for display null value
                $fieldContainer.addClass(' js-show-label');
                $wrapper.addClass('apex-item-wrapper--has-initial-value');
            } else {
                $fieldContainer.removeClass('is-active js-show-label');
                $wrapper.removeClass('apex-item-wrapper--has-initial-value');
            }

            //destroy the dom componentns
            this.currentDropdown.remove();
            this.currentDropdown = null;
            $(document).off('mousedown.regexLov');
            $(document).off('keydown.regexLov');
        }
    }
};
