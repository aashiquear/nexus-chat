import React, { lazy, Suspense } from 'react'

const PlotInner = lazy(() =>
  Promise.all([
    import('plotly.js-dist-min'),
    import('react-plotly.js/factory'),
  ]).then(([Plotly, factory]) => {
    const Plot = factory.default(Plotly.default)
    return { default: Plot }
  })
)

export default function LazyPlot(props) {
  return (
    <Suspense fallback={<div className="plot-loading">Loading chart…</div>}>
      <PlotInner {...props} />
    </Suspense>
  )
}
