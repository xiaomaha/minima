interface RatingProps {
  value: number
  class?: string
}

export const Rating = (props: RatingProps) => {
  return (
    <div class={`relative inline-block select-none text-sm ${props.class ?? ''}`}>
      <div class="text-base-content/20">★★★★★</div>
      <div class="absolute inset-0 overflow-hidden text-warning" style={{ width: `${(props.value / 5) * 100}%` }}>
        ★★★★★
      </div>
    </div>
  )
}
