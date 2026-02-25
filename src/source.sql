PROCEDURE render_regex_lov (
    p_item       IN             apex_plugin.t_page_item,
    p_plugin     IN             apex_plugin.t_plugin,
    p_param      IN             apex_plugin.t_item_render_param,
    p_result     OUT            apex_plugin.t_item_render_result 
)
IS
    l_display_value VARCHAR2(4000);
    l_name          VARCHAR2(30);
    l_name_attr     VARCHAR2(100) := '';
    l_is_readonly      BOOLEAN := p_param.is_readonly;
    l_container_cls VARCHAR2(255) := 't-Form-inputContainer regex-lov-container';
    l_btn_style     VARCHAR2(255) := '"border-top-left-radius: 0; border-bottom-left-radius: 0; margin-left: -1px;';
BEGIN
    -- Get the correct name attribute based on the current context
    l_name := apex_plugin.get_input_name_for_page_item(p_is_multi_value => false);

    -- Only append the name attribute if APEX actually provided one
    -- Only Page Items can have name="...", in IG the cell cant have a name as it is not being send to the server
    IF l_name IS NOT NULL THEN
        l_name_attr := ' name="' || l_name || '"';
    END IF;

    -- gets the display value it has on load based on param value
    IF p_param.value IS NOT NULL THEN
        l_display_value := apex_plugin_util.get_display_data(
            p_sql_statement     => p_item.lov_definition,
            p_min_columns       => 2,
            p_max_columns       => 2,
            p_component_name    => p_item.name,
            p_display_column_no => 1,
            p_search_column_no  => 2,
            p_search_string     => p_param.value 
        );

        IF l_display_value IS NULL THEN
            l_display_value := p_param.value; --if nothing was found display the raw data
        END IF;
    ELSE
        --else display the display null text
        l_display_value := p_item.lov_null_text ;
    END IF;

    IF l_is_readonly THEN
        l_container_cls := l_container_cls || ' is-readonly apex_disabled';
        l_btn_style     := l_btn_style || ' display: none;'; -- Hide the button
    END IF;

    -- the hidden input where the raw data is being stored, adds the name attribute if its a page item and sets the initial value
    sys.htp.p('<input type="hidden" id="' || p_item.name || '"' || l_name_attr || ' value="' || sys.htf.escape_sc(p_param.value) || '">');
    
    -- ui
    sys.htp.p('<div class="t-Form-inputContainer regex-lov-container ' || case when l_is_readonly then ' is-readonly apex_disabled' end ||'" style="display: flex; align-items: center;">');
    sys.htp.p('<input type="text" id="' || p_item.name || '_DISPLAY" class="apex-item-text" value="' || sys.htf.escape_sc(l_display_value) || '" style="flex-grow: 1; border-top-right-radius: 0; border-bottom-right-radius: 0;" readonly>');
    sys.htp.p('<button type="button" id="' || p_item.name || '_BTN" class="a-Button a-Button--popupLOV" style=' || l_btn_style||'" tabindex="-1"><span class="fa fa-angle-down" aria-hidden="true"></span></button>');
    sys.htp.p('</div>');

    apex_javascript.add_onload_code(
    p_code => 'regexLov.init("' || p_item.name || '", "' || 
                apex_plugin.get_ajax_identifier || '", "' || 
                (CASE WHEN p_item.lov_display_null THEN 'true' ELSE 'false' END) || '", "' ||               
                sys.htf.escape_sc(p_item.lov_null_value) || '", "' ||            
                sys.htf.escape_sc(p_item.lov_null_text) || '", "' || 
              (CASE WHEN l_is_readonly THEN 'true' ELSE 'false' END) || '");'
);
    
END render_regex_lov;

PROCEDURE ajax_regex_lov (
    p_item       IN             apex_plugin.t_page_item,
    p_plugin     IN             apex_plugin.t_plugin,
    p_param      IN             apex_plugin.t_item_ajax_param,
    p_result     OUT            apex_plugin.t_item_ajax_result 
)
IS
    l_search_str    VARCHAR2(4000) := apex_application.g_x01;
    l_search_mode   VARCHAR2(10)   := apex_application.g_x02; 
    
    l_column_value_list    apex_plugin_util.t_column_value_list;
    
    l_display_val   VARCHAR2(4000);
    l_return_val    VARCHAR2(4000);
    l_match         BOOLEAN;

    l_search        varchar2(4000);
    l_calc_str      varchar2(4000);
    l_anchor        varchar(1);

    TYPE t_sort_map IS TABLE OF PLS_INTEGER INDEX BY VARCHAR2(32000); 
    l_sorted_rows   t_sort_map;
    l_sort_key      VARCHAR2(32000);
    l_curr_idx      VARCHAR2(32000); -- key for iteration
    l_original_idx  PLS_INTEGER;
BEGIN
    -- fetches the data
    l_column_value_list := apex_plugin_util.get_data (
            p_sql_statement    => p_item.lov_definition,
            p_min_columns      => 2,
            p_max_columns      => 2,
            p_component_name   => p_item.name
        );

    apex_json.open_object;
    apex_json.open_array('results');


    l_calc_str := l_search_str;
    l_anchor   := NULL;

    --check if the string starts with a % if so then it removes the leading %
    -- and later adds the ^ to the beginning of the string so it searches for starts with
    IF SUBSTR(l_calc_str, 1, 1) = '%' THEN
        l_calc_str := SUBSTR(l_calc_str, 2);
        l_anchor   := '^';                   
    END IF;

    l_search := REPLACE(
                    REPLACE( 
                        REGEXP_REPLACE(
                            REPLACE(l_calc_str, '\%', 'pdE7KGuBHXC7ef9rMx8xNRN4zkS1si8k'), --some api key i found, never ever is used in plain text
                        '([^a-zA-Z0-9[:space:]])', '\\\1'), 
                    '\%', '.*')
                , 'pdE7KGuBHXC7ef9rMx8xNRN4zkS1si8k', '\%');

    l_search := l_anchor || l_search;

    -- loops throught the data
    FOR i IN 1 .. l_column_value_list(1).count LOOP
        
        l_display_val := l_column_value_list(1)(i);
        
        IF l_column_value_list.count >= 2 THEN
            l_return_val := l_column_value_list(2)(i);
        ELSE
            l_return_val := l_display_val; 
        END IF;
        
        l_match := FALSE;
        
        IF l_search_str IS NULL THEN
            l_match := TRUE;
        ELSE
            BEGIN
                IF l_search_mode = 'REGEX' THEN
                    -- Check Regex (Case insensitive 'i')
                    IF REGEXP_LIKE(l_display_val, l_search_str, 'i') THEN
                        l_match := TRUE;
                    END IF;
                ELSIF l_search_mode = 'SIMPLE' THEN --if some other search is desired just add a elsif here
                    IF REGEXP_LIKE(l_display_val, l_search , 'i') THEN
                        l_match := TRUE;
                    END IF;
                ELSE
                -- Check Like (Standard)
                    IF UPPER(l_display_val) LIKE '%' || UPPER(l_search_str) || '%' THEN
                        l_match := TRUE;
                    END IF;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                -- catch invalid regex syntax from the user
                l_match := FALSE; 
            END;
        END IF;

        IF l_match THEN
            -- generate order key
            IF l_search_str IS NOT NULL THEN
               --priority for exact match
                l_sort_key := CASE 
                                WHEN UPPER(l_display_val) = UPPER(l_search_str) THEN '0' 
                                ELSE '1' 
                              END
                              || '-' || TO_CHAR(LENGTH(l_display_val), 'FM000000') 
                              || '-' || UPPER(l_display_val);
            ELSE
                l_sort_key := TO_CHAR(LENGTH(l_return_val), 'FM000000') 
                              || '-' || UPPER(l_return_val);
            END IF;

            -- Append index 'i' to ensure unique keys (prevent overwrites)
            l_sorted_rows(l_sort_key || '-' || i) := i;
        END IF;
        
    END LOOP;

    l_curr_idx := l_sorted_rows.FIRST;
    
    WHILE l_curr_idx IS NOT NULL LOOP
        l_original_idx := l_sorted_rows(l_curr_idx);
        
        l_display_val := l_column_value_list(1)(l_original_idx);
        
        IF l_column_value_list.count >= 2 THEN
            l_return_val := l_column_value_list(2)(l_original_idx);
        ELSE
            l_return_val := l_display_val;
        END IF;
        --append the json
        apex_json.open_object;
        apex_json.write('display_name', l_display_val);
        apex_json.write('id', l_return_val);
        apex_json.close_object;

        l_curr_idx := l_sorted_rows.NEXT(l_curr_idx);
    END LOOP;
    apex_json.close_array;
    apex_json.close_object;
END ajax_regex_lov;