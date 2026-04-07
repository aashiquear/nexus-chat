"""
Graph Plotter tool.

Uses matplotlib to generate plots from CSV data or LLM-provided numeric data.
Supports bar, scatter, line, pie, histogram, parity, and more.
Saves the generated plot as a PNG in the data directory.
"""

import json
import uuid
import csv
import io
import os
from pathlib import Path

from . import BaseTool, register_tool


@register_tool("graph_plotter")
class GraphPlotterTool(BaseTool):
    name = "graph_plotter"
    description = (
        "Plot graphs from CSV files or numeric data. Supports chart types: "
        "line, bar, scatter, pie, histogram, parity (predicted vs actual), "
        "box, area, and heatmap. Provide either a CSV filename (from uploads) "
        "and column names, or direct x/y data arrays. Returns the saved PNG "
        "path for display."
    )
    parameters = {
        "type": "object",
        "properties": {
            "chart_type": {
                "type": "string",
                "enum": ["line", "bar", "scatter", "pie", "histogram", "parity", "box", "area", "heatmap"],
                "description": "Type of chart to plot.",
            },
            "title": {
                "type": "string",
                "description": "Title for the chart.",
            },
            "x_label": {
                "type": "string",
                "description": "Label for the x-axis.",
            },
            "y_label": {
                "type": "string",
                "description": "Label for the y-axis.",
            },
            "csv_filename": {
                "type": "string",
                "description": "Name of an uploaded CSV file to read data from.",
            },
            "x_column": {
                "type": "string",
                "description": "Column name in CSV to use for x-axis data.",
            },
            "y_column": {
                "type": "string",
                "description": "Column name in CSV to use for y-axis data.",
            },
            "y_columns": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Multiple column names for multi-series plots.",
            },
            "x_data": {
                "type": "array",
                "items": {},
                "description": "Direct x-axis data array (numbers or labels).",
            },
            "y_data": {
                "type": "array",
                "items": {},
                "description": "Direct y-axis data array (numbers).",
            },
            "y_data_series": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "label": {"type": "string"},
                        "data": {"type": "array", "items": {}},
                    },
                },
                "description": "Multiple y-data series for multi-line/bar plots.",
            },
            "labels": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Labels for pie chart slices or legend entries.",
            },
            "color": {
                "type": "string",
                "description": "Color for the plot (e.g. '#5a8a7a', 'steelblue').",
            },
            "colors": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Color palette for multi-series or pie charts.",
            },
            "grid": {
                "type": "boolean",
                "description": "Show grid lines (default true).",
            },
        },
        "required": ["chart_type"],
    }

    async def execute(self, **kwargs) -> str:
        try:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt
            import numpy as np
        except ImportError:
            return json.dumps({"error": "matplotlib or numpy not installed."})

        chart_type = kwargs.get("chart_type", "line")
        title = kwargs.get("title", "Chart")
        x_label = kwargs.get("x_label", "")
        y_label = kwargs.get("y_label", "")
        grid = kwargs.get("grid", True)

        # Resolve data from CSV or direct input
        x_data = kwargs.get("x_data")
        y_data = kwargs.get("y_data")
        y_data_series = kwargs.get("y_data_series")
        labels = kwargs.get("labels")
        csv_filename = kwargs.get("csv_filename")

        upload_dir = Path(self.config.get("upload_dir", "./data/uploads"))

        # Load from CSV if specified
        if csv_filename:
            csv_path = upload_dir / csv_filename
            if not csv_path.exists():
                return json.dumps({"error": f"CSV file not found: {csv_filename}"})
            try:
                x_data, y_data, y_data_series, labels = self._read_csv(
                    csv_path, kwargs
                )
            except Exception as e:
                return json.dumps({"error": f"Failed to read CSV: {e}"})

        # Validate we have data
        if chart_type == "pie":
            if y_data is None:
                return json.dumps({"error": "y_data is required for pie charts."})
        elif chart_type in ("histogram", "box"):
            if y_data is None and y_data_series is None:
                return json.dumps({"error": "y_data is required for this chart type."})
        elif chart_type == "heatmap":
            if y_data_series is None and y_data is None:
                return json.dumps({"error": "Data is required for heatmap."})
        else:
            if x_data is None and y_data is None:
                return json.dumps({"error": "Provide x_data/y_data or a csv_filename with column names."})

        # Theme colors
        default_colors = [
            "#5a8a7a", "#c4993c", "#5a7a8a", "#b85450", "#6b9d8c",
            "#8a6b9d", "#9d8a6b", "#4a7a6a", "#7a5a8a", "#8a9d6b",
        ]
        color = kwargs.get("color", default_colors[0])
        colors = kwargs.get("colors", default_colors)

        # Create figure
        fig, ax = plt.subplots(figsize=(10, 6), dpi=100)
        fig.patch.set_facecolor("#f7f6f3")
        ax.set_facecolor("#ffffff")

        try:
            if chart_type == "line":
                self._plot_line(ax, x_data, y_data, y_data_series, colors, labels)
            elif chart_type == "bar":
                self._plot_bar(ax, x_data, y_data, y_data_series, colors, labels, np)
            elif chart_type == "scatter":
                self._plot_scatter(ax, x_data, y_data, y_data_series, colors, labels)
            elif chart_type == "pie":
                self._plot_pie(ax, y_data, labels, colors)
            elif chart_type == "histogram":
                data = y_data if y_data is not None else [s["data"] for s in y_data_series]
                if isinstance(data[0], list):
                    for i, d in enumerate(data):
                        lbl = y_data_series[i].get("label", f"Series {i+1}") if y_data_series else None
                        ax.hist([float(v) for v in d], bins='auto', alpha=0.7,
                                color=colors[i % len(colors)], label=lbl, edgecolor='white')
                    if y_data_series:
                        ax.legend(framealpha=0.9)
                else:
                    ax.hist([float(v) for v in data], bins='auto',
                            color=color, edgecolor='white', alpha=0.85)
            elif chart_type == "parity":
                self._plot_parity(ax, x_data, y_data, color, np)
            elif chart_type == "box":
                data = y_data if y_data is not None else [s["data"] for s in y_data_series]
                if y_data_series:
                    box_data = [[float(v) for v in s["data"]] for s in y_data_series]
                    bp = ax.boxplot(box_data, patch_artist=True,
                                    labels=[s.get("label", f"S{i+1}") for i, s in enumerate(y_data_series)])
                    for patch, c in zip(bp['boxes'], colors):
                        patch.set_facecolor(c)
                        patch.set_alpha(0.7)
                else:
                    bp = ax.boxplot([[float(v) for v in data]], patch_artist=True)
                    bp['boxes'][0].set_facecolor(color)
                    bp['boxes'][0].set_alpha(0.7)
            elif chart_type == "area":
                self._plot_area(ax, x_data, y_data, y_data_series, colors, labels)
            elif chart_type == "heatmap":
                self._plot_heatmap(ax, y_data, y_data_series, labels, kwargs, plt)

            ax.set_title(title, fontsize=14, fontweight="600", pad=12, color="#2c2c2c")
            if x_label and chart_type != "pie":
                ax.set_xlabel(x_label, fontsize=11, color="#6b6b6b")
            if y_label and chart_type != "pie":
                ax.set_ylabel(y_label, fontsize=11, color="#6b6b6b")
            if grid and chart_type not in ("pie", "heatmap"):
                ax.grid(True, alpha=0.3, linestyle="--")
            ax.tick_params(colors="#6b6b6b", labelsize=10)
            for spine in ax.spines.values():
                spine.set_color("#e2e0d8")

            plt.tight_layout()

            # Save
            output_dir = Path(self.config.get("output_dir", "./data"))
            output_dir.mkdir(parents=True, exist_ok=True)
            filename = f"plot-{uuid.uuid4().hex[:8]}.png"
            filepath = output_dir / filename
            fig.savefig(filepath, bbox_inches="tight", facecolor=fig.get_facecolor())
            plt.close(fig)

            return json.dumps({
                "title": title,
                "chart_type": chart_type,
                "filename": filename,
                "path": str(filepath),
                "plot_image": filename,
            })

        except Exception as e:
            plt.close(fig)
            return json.dumps({"error": f"Plot failed: {e}"})

    def _read_csv(self, csv_path: Path, kwargs: dict):
        """Read CSV and extract data based on column names."""
        with open(csv_path, newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        if not rows:
            raise ValueError("CSV file is empty")

        x_col = kwargs.get("x_column")
        y_col = kwargs.get("y_column")
        y_cols = kwargs.get("y_columns")
        labels_col = kwargs.get("labels")

        x_data = None
        y_data = None
        y_data_series = None
        labels = labels_col

        if x_col:
            x_data = []
            for r in rows:
                val = r.get(x_col, "")
                try:
                    x_data.append(float(val))
                except (ValueError, TypeError):
                    x_data.append(val)

        if y_col:
            y_data = []
            for r in rows:
                try:
                    y_data.append(float(r.get(y_col, 0)))
                except (ValueError, TypeError):
                    y_data.append(0)

        if y_cols:
            y_data_series = []
            for col in y_cols:
                series_data = []
                for r in rows:
                    try:
                        series_data.append(float(r.get(col, 0)))
                    except (ValueError, TypeError):
                        series_data.append(0)
                y_data_series.append({"label": col, "data": series_data})

        # For pie chart, use labels from x_column
        if kwargs.get("chart_type") == "pie" and x_col and not labels:
            labels = [str(r.get(x_col, "")) for r in rows]

        return x_data, y_data, y_data_series, labels

    def _plot_line(self, ax, x_data, y_data, y_data_series, colors, labels):
        if y_data_series:
            for i, series in enumerate(y_data_series):
                lbl = series.get("label", f"Series {i+1}")
                d = [float(v) for v in series["data"]]
                x = x_data if x_data else list(range(len(d)))
                ax.plot(x, d, color=colors[i % len(colors)], label=lbl,
                        linewidth=2, marker="o", markersize=4)
            ax.legend(framealpha=0.9)
        else:
            x = x_data if x_data else list(range(len(y_data)))
            ax.plot(x, [float(v) for v in y_data], color=colors[0],
                    linewidth=2, marker="o", markersize=4,
                    label=labels[0] if labels else None)
            if labels:
                ax.legend(framealpha=0.9)

    def _plot_bar(self, ax, x_data, y_data, y_data_series, colors, labels, np):
        if y_data_series:
            n = len(y_data_series)
            x_pos = np.arange(len(y_data_series[0]["data"]))
            width = 0.8 / n
            for i, series in enumerate(y_data_series):
                lbl = series.get("label", f"Series {i+1}")
                d = [float(v) for v in series["data"]]
                ax.bar(x_pos + i * width - (n - 1) * width / 2, d,
                       width=width, color=colors[i % len(colors)],
                       label=lbl, alpha=0.85, edgecolor='white')
            if x_data:
                ax.set_xticks(x_pos)
                ax.set_xticklabels([str(v) for v in x_data], rotation=45, ha='right')
            ax.legend(framealpha=0.9)
        else:
            x = x_data if x_data else list(range(len(y_data)))
            ax.bar(range(len(y_data)), [float(v) for v in y_data],
                   color=colors[0], alpha=0.85, edgecolor='white')
            if x_data:
                ax.set_xticks(range(len(x)))
                ax.set_xticklabels([str(v) for v in x], rotation=45, ha='right')

    def _plot_scatter(self, ax, x_data, y_data, y_data_series, colors, labels):
        if y_data_series:
            for i, series in enumerate(y_data_series):
                lbl = series.get("label", f"Series {i+1}")
                d = [float(v) for v in series["data"]]
                x = x_data if x_data else list(range(len(d)))
                ax.scatter(x, d, color=colors[i % len(colors)], label=lbl,
                           alpha=0.7, s=50, edgecolors='white', linewidth=0.5)
            ax.legend(framealpha=0.9)
        else:
            x = x_data if x_data else list(range(len(y_data)))
            ax.scatter(x, [float(v) for v in y_data], color=colors[0],
                       alpha=0.7, s=50, edgecolors='white', linewidth=0.5)

    def _plot_pie(self, ax, y_data, labels, colors):
        data = [float(v) for v in y_data]
        pie_labels = labels if labels else [f"Slice {i+1}" for i in range(len(data))]
        wedges, texts, autotexts = ax.pie(
            data, labels=pie_labels, colors=colors[:len(data)],
            autopct="%1.1f%%", startangle=90, pctdistance=0.85,
            wedgeprops=dict(edgecolor='white', linewidth=2),
        )
        for t in autotexts:
            t.set_fontsize(9)
            t.set_color("#2c2c2c")

    def _plot_parity(self, ax, x_data, y_data, color, np):
        """Parity plot: actual vs predicted with y=x reference line."""
        x = [float(v) for v in x_data]
        y = [float(v) for v in y_data]
        ax.scatter(x, y, color=color, alpha=0.7, s=50,
                   edgecolors='white', linewidth=0.5, label="Data")
        all_vals = x + y
        vmin, vmax = min(all_vals), max(all_vals)
        pad = (vmax - vmin) * 0.05
        ref = np.linspace(vmin - pad, vmax + pad, 100)
        ax.plot(ref, ref, '--', color='#b85450', linewidth=1.5, alpha=0.7, label="y = x")
        ax.set_xlim(vmin - pad, vmax + pad)
        ax.set_ylim(vmin - pad, vmax + pad)
        ax.set_aspect('equal', adjustable='box')
        ax.legend(framealpha=0.9)

    def _plot_area(self, ax, x_data, y_data, y_data_series, colors, labels):
        if y_data_series:
            for i, series in enumerate(y_data_series):
                lbl = series.get("label", f"Series {i+1}")
                d = [float(v) for v in series["data"]]
                x = x_data if x_data else list(range(len(d)))
                ax.fill_between(x, d, alpha=0.3, color=colors[i % len(colors)])
                ax.plot(x, d, color=colors[i % len(colors)], label=lbl, linewidth=1.5)
            ax.legend(framealpha=0.9)
        else:
            x = x_data if x_data else list(range(len(y_data)))
            d = [float(v) for v in y_data]
            ax.fill_between(x, d, alpha=0.3, color=colors[0])
            ax.plot(x, d, color=colors[0], linewidth=1.5)

    def _plot_heatmap(self, ax, y_data, y_data_series, labels, kwargs, plt):
        if y_data_series:
            data = [[float(v) for v in s["data"]] for s in y_data_series]
        else:
            # y_data should be a 2D array (list of lists)
            data = y_data if isinstance(y_data[0], list) else [y_data]

        import numpy as np
        arr = np.array(data, dtype=float)
        im = ax.imshow(arr, cmap="YlGnBu", aspect="auto")
        plt.colorbar(im, ax=ax, shrink=0.8)
        if labels:
            ax.set_xticks(range(len(labels)))
            ax.set_xticklabels(labels, rotation=45, ha='right')
        if y_data_series:
            ax.set_yticks(range(len(y_data_series)))
            ax.set_yticklabels([s.get("label", f"Row {i}") for i, s in enumerate(y_data_series)])
