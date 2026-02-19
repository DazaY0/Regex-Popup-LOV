var regexLov = {
    currentDropdown: null,

    init: function(itemId, ajaxId, nullText) {
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
                $display.prop('disabled', false);
                $btn.prop('disabled', false);
            },
            disable: function() {
                $display.prop('disabled', true);
                $btn.prop('disabled', true);
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
                regexLov.toggleDropdown(itemId, ajaxId);
            }
        };

        $btn.on("click", toggleHandler);
        $display.prop('readonly', true).on("click", toggleHandler);

        $(window).on("resize." + itemId, function() {
            regexLov.closeDropdown();
        });
        
    },

    toggleDropdown: function(itemId, ajaxId) {
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

        var searchMode = 'LIKE';

        var content = `
            <div id="regex_dropdown_${itemId}" class="regex-lov-dropdown">
                <div class="lov-header">
                    <div class="lov-search-row">
                        <input type="text" id="lovSearch" class="apex-item-text lov-search-input"  autocomplete="off">
                        <button type="button" id="btnSearch" class="t-Button t-Button--icon t-Button--hot t-Button--small" title="Search">
                            <span class="fa fa-search" aria-hidden="true"></span>
                        </button>
                        <button type="button" id="modeToggle" class="t-Button t-Button--icon t-Button--noLabel t-Button--small" title="Current: LIKE">
                           <span class="fa fa-language" aria-hidden="true"></span>
                        </button>
                    </div>
                    <div id="modeStatus" class="lov-mode-status">Mode: <strong>LIKE</strong></div>
                </div>
                <ul id="lovResults" class="lov-list">
                    <li class="lov-empty"><span class="fa fa-search" aria-hidden="true"></span><p>No results found</p></li>
                </ul>
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

        // AJAX Search
        function performSearch() {
            var val = $searchInput.val();
            var $list = $dropdown.find("#lovResults");
            
            //prevent blank searches for regex as that doesnt return anything
            if(searchMode === 'REGEX' && val === '') {
                 $list.html('<li class="lov-empty"><span class="fa fa-search" aria-hidden="true"></span><p>No results found</p></li>');
                 return;
            }


            $list.html('<li class="lov-loading"><span class="fa fa-spinner fa-anim-spin"></span> Searching...</li>');
            
            //perform the search
            apex.server.plugin(ajaxId, { 
                x01: val,
                x02: searchMode
            }, {
                success: function(data) {
                    $list.empty();
                    if (!data.results || data.results.length === 0) { //if no results have been found
                        $list.append('<li class="lov-empty"><span class="fa fa-search" aria-hidden="true"></span><p>No results found</p></li>');
                    } else {
                        $.each(data.results, function(i, item) { //if found create a list

                            $("<li>")
                                .text(item.display_name) 
                                .addClass("lov-item")
                               .on("mousedown", function(e) { 
                                    e.preventDefault();

                                    apex.item(itemId).setValue(item.id, item.display_name); //change the value and the display value
                                    $("#" + itemId).trigger("change");//for interactive grid

                                    regexLov.closeDropdown();
                                })
                                .appendTo($list);
                        });
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

        $dropdown.find("#modeToggle").on("click", function(e) {
            e.stopPropagation();
            if (searchMode === 'LIKE') { //switch between the two states
                searchMode = 'REGEX';
                $("#modeStatus").html("Mode: <strong>REGEX</strong>").addClass("is-regex");
                $(this).addClass("is-active");
                $("#modeToggle").attr("title", "Current: REGEX");
            } else {
                searchMode = 'LIKE';
                $("#modeStatus").html("Mode: <strong>LIKE</strong>").removeClass("is-regex");
                $(this).removeClass("is-active");
                $("#modeToggle").attr("title", "Current: LIKE");
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
                $fieldContainer.addClass('is-active js-show-label');
                $wrapper.addClass('apex-item-wrapper--has-initial-value');
            } else {
                $fieldContainer.removeClass('is-active js-show-label');
                $wrapper.removeClass('apex-item-wrapper--has-initial-value');
            }

           //destroy the dom componentns
            this.currentDropdown.remove();
            this.currentDropdown = null;
            $(document).off('click.regexLov');
        
        }
    }
};
