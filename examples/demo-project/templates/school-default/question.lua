local question_counter = 0

local function stringify(value)
  if value == nil then
    return ""
  end
  return pandoc.utils.stringify(value)
end

local function read_file(path)
  local file = io.open(path, "rb")
  if not file then
    return nil
  end

  local content = file:read("*a")
  file:close()
  return content
end

local function meta_lookup(meta, group, key)
  if meta == nil then
    return nil
  end

  local value = meta[group]
  if value == nil then
    return nil
  end

  return value[key]
end

local function meta_bool(meta, group, key, default)
  local value = meta_lookup(meta, group, key)
  if value == nil then
    return default
  end
  if type(value) == "boolean" then
    return value
  end
  if value.t == "MetaBool" then
    return value.value
  end

  local text = stringify(value):lower()
  if text == "true" or text == "yes" or text == "1" then
    return true
  end
  if text == "false" or text == "no" or text == "0" then
    return false
  end
  return default
end

local function env_string(name)
  local value = os.getenv(name)
  if value == nil then
    return ""
  end
  return tostring(value)
end

local function env_bool(name)
  local value = env_string(name):lower()
  if value == "" then
    return nil
  end
  if value == "true" or value == "yes" or value == "1" then
    return true
  end
  if value == "false" or value == "no" or value == "0" then
    return false
  end
  return nil
end

local function format_score(score)
  if score == nil then
    return nil
  end
  if score == math.floor(score) then
    return tostring(math.floor(score))
  end
  return tostring(score)
end

local function resolve_question_path(path)
  if pandoc.path.is_absolute(path) then
    return pandoc.path.normalize(path)
  end

  local input_dir = pandoc.path.directory(quarto.doc.input_file)
  return pandoc.path.normalize(pandoc.path.join({ input_dir, path }))
end

local function clone_blocks(blocks)
  local output = {}
  for _, block in ipairs(blocks or {}) do
    output[#output + 1] = block
  end
  return output
end

local function find_section_class(div)
  if div.t ~= "Div" then
    return nil
  end

  for _, class in ipairs(div.attr.classes or {}) do
    if class == "stem" or class == "options" or class == "answer" or class == "analysis" then
      return class
    end
  end

  return nil
end

local function parse_question_sections(doc)
  local sections = {}
  local found_named_sections = false

  for _, block in ipairs(doc.blocks) do
    local class = find_section_class(block)
    if class ~= nil then
      sections[class] = clone_blocks(block.content)
      found_named_sections = true
    end
  end

  if not found_named_sections then
    sections.stem = clone_blocks(doc.blocks)
  end

  return sections, doc.meta or {}
end

local function label_inlines(index, score, show_score)
  local inlines = {
    pandoc.Strong({ pandoc.Str(tostring(index) .. ".") }),
  }

  if show_score and score ~= nil then
    inlines[#inlines + 1] = pandoc.Space()
    inlines[#inlines + 1] = pandoc.Emph({ pandoc.Str("（" .. format_score(score) .. " 分）") })
  end

  inlines[#inlines + 1] = pandoc.Space()
  return inlines
end

local function prepend_label(blocks, index, score, show_score)
  local output = clone_blocks(blocks)
  local prefix = label_inlines(index, score, show_score)
  local first = output[1]

  if first ~= nil and (first.t == "Para" or first.t == "Plain") then
    local merged = {}
    for _, inline in ipairs(prefix) do
      merged[#merged + 1] = inline
    end
    for _, inline in ipairs(first.content) do
      merged[#merged + 1] = inline
    end

    if first.t == "Para" then
      output[1] = pandoc.Para(merged)
    else
      output[1] = pandoc.Plain(merged)
    end

    return output
  end

  local labeled = { pandoc.Para(prefix) }
  for _, block in ipairs(output) do
    labeled[#labeled + 1] = block
  end
  return labeled
end

local function append_blocks(target, blocks)
  for _, block in ipairs(blocks or {}) do
    target[#target + 1] = block
  end
end

local function append_labeled_section(target, label, blocks)
  if blocks == nil or #blocks == 0 then
    return
  end

  target[#target + 1] = pandoc.Para({ pandoc.Strong({ pandoc.Str(label) }) })
  append_blocks(target, blocks)
end

local function question_shortcode(args, kwargs, meta, _raw_args, context)
  if context ~= "block" then
    return quarto.shortcode.error_output("question", "question shortcode must be used in block context", context)
  end

  local file = stringify(kwargs["file"] or kwargs["path"] or args[1])
  if file == "" then
    return quarto.shortcode.error_output("question", "missing file argument", context)
  end

  local score_text = stringify(kwargs["score"] or args[2])
  local score = tonumber(score_text)
  local source = read_file(resolve_question_path(file))
  if source == nil then
    return quarto.shortcode.error_output("question", "unable to read question file: " .. file, context)
  end

  local ok, doc = pcall(
    pandoc.read,
    source,
    "markdown+yaml_metadata_block+fenced_divs+raw_attribute+tex_math_dollars"
  )
  if not ok then
    return quarto.shortcode.error_output("question", "unable to parse question file: " .. file, context)
  end

  local sections, question_meta = parse_question_sections(doc)
  local mode = env_string("PAPERFLOW_MODE")
  if mode == "" then
    mode = stringify(meta_lookup(meta, "paperflow", "mode"))
  end

  local show_score = env_bool("PAPERFLOW_SHOW_SCORE")
  if show_score == nil then
    show_score = meta_bool(meta, "paperflow", "show_score", mode == "teacher")
  end

  local show_answer = env_bool("PAPERFLOW_SHOW_ANSWER")
  if show_answer == nil then
    show_answer = meta_bool(meta, "paperflow", "show_answer", mode == "teacher")
  end

  local show_analysis = env_bool("PAPERFLOW_SHOW_ANALYSIS")
  if show_analysis == nil then
    show_analysis = meta_bool(meta, "paperflow", "show_analysis", mode == "teacher")
  end

  question_counter = question_counter + 1

  local blocks = prepend_label(sections.stem or {}, question_counter, score, show_score)
  append_blocks(blocks, sections.options)

  if show_answer then
    append_labeled_section(blocks, "答案", sections.answer)
  end
  if show_analysis then
    append_labeled_section(blocks, "解析", sections.analysis)
  end

  local identifier = stringify(question_meta.id)
  return {
    pandoc.Div(blocks, pandoc.Attr(identifier, { "paperflow-question" }, {
      ["data-question-file"] = file,
    })),
  }
end

return {
  ["question"] = question_shortcode,
}
