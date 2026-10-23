# Accessible data and exports

Every rendered dataset has a shared accessible data table and CSV representation. Graphs expose node/link tables; hierarchies include parent IDs; custom series use their typed row projection. Navigation rules become ordinary keyboard-accessible links.

CSV uses the current resolved snapshot, including when explicitly marked stale. It preserves exact SQL display strings, quotes cells, and prefixes formula-like text to reduce spreadsheet formula execution. Null cells remain empty. The chart frame clears exports when data becomes unavailable or access is denied.

Image buttons require both a manifest capability and a live adapter handle. ECharts supports PNG for canvas and SVG for SVG rendering; it does not advertise JPEG or PDF. Canvas scale must be positive. SVG export supports scale 1. Exports contain the chart image; the surrounding filters, data table and page layout are not included.

Custom adapters may implement additional formats. An implementation must reject unsupported mode/format combinations rather than return a mislabeled file.
