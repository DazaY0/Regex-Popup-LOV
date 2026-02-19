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

    -- the hidden input where the raw data is being stored, adds the name attribute if its a page item and sets the initial value
    sys.htp.p('<input type="hidden" id="' || p_item.name || '"' || l_name_attr || ' value="' || sys.htf.escape_sc(p_param.value) || '">');
    
    -- ui
    sys.htp.p('<div class="t-Form-inputContainer regex-lov-container" style="display: flex; align-items: center;">');
    sys.htp.p('<input type="text" id="' || p_item.name || '_DISPLAY" class="apex-item-text" value="' || sys.htf.escape_sc(l_display_value) || '" style="flex-grow: 1; border-top-right-radius: 0; border-bottom-right-radius: 0;" readonly>');
    sys.htp.p('<button type="button" id="' || p_item.name || '_BTN" class="a-Button a-Button--popupLOV" style="border-top-left-radius: 0; border-bottom-left-radius: 0; margin-left: -1px;" tabindex="-1"><span class="fa fa-angle-down" aria-hidden="true"></span></button>');
    sys.htp.p('</div>');

    apex_javascript.add_onload_code(
        p_code => 'regexLov.init("' || p_item.name || '", "' || 
                  apex_plugin.get_ajax_identifier || '", "' || 
                  sys.htf.escape_sc(p_item.lov_null_text) || '");'
    );
    
END render_regex_lov;


PROCEDURE ajax_regex_lov (
    p_item       IN            apex_plugin.t_page_item,
    p_plugin     IN            apex_plugin.t_plugin,
    p_param      IN            apex_plugin.t_item_ajax_param,
    p_result     OUT           apex_plugin.t_item_ajax_result 
)
IS
    l_search_str    VARCHAR2(4000) := apex_application.g_x01;
    l_search_mode   VARCHAR2(10)   := apex_application.g_x02; 
    
    l_column_value_list    apex_plugin_util.t_column_value_list;
    
    l_display_val   VARCHAR2(4000);
    l_return_val    VARCHAR2(4000);
    l_match         BOOLEAN;
    l_result_count  NUMBER := 0;
    l_first         boolean;
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
    if p_item.lov_display_null then --if the display null attribute is toggled on it always adds a null value
        l_first := false;
    else
        l_first := true; --if not it just ignores it later
    end if;

    -- loops throught the data
        for i in 1 .. l_column_value_list(1).count
    loop
        
        l_display_val :=l_column_value_list(1)(i);
        
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
                ELSE
                    -- Check Like (Standard)
                    IF UPPER(l_display_val) LIKE '%' || UPPER(l_search_str) || '%' THEN
                        l_match := TRUE;
                    END IF;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                l_match := FALSE; -- Invalid Regex
            END;
        END IF;

        --write in the json
        IF l_match THEN
            if l_first = false then --can only be false if display-null is activated
                l_first := true; -- set it to true so it only adds it one time
                apex_json.open_object;
                apex_json.write('display_name', p_item.lov_null_text);
                apex_json.write('id', p_item.lov_null_value);
                apex_json.close_object;
            end if;
            apex_json.open_object;
            apex_json.write('display_name', l_display_val);
            apex_json.write('id', l_return_val);
            apex_json.close_object;
            
            l_result_count := l_result_count + 1;
            
            IF l_result_count >= 50 THEN
                EXIT;
            END IF;

        END IF;
        

    END LOOP;

    apex_json.close_array;
    apex_json.close_object;
END ajax_regex_lov;
