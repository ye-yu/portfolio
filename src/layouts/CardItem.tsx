import { Display } from "../components/Display"
import { Pill } from "../components/Pill"
import stylesheet from "../styles"

interface CardProps extends Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "children"> {
  title: string
  pills: string[]
  content: string
  center?: boolean
}


export function CardItem({ title, style = {}, center = false, pills, content }: CardProps) {
  return <div style={{
    ...stylesheet.ColumnFlex,
    ...style,
  }}>
    <Display style={{
      fontSize: "1.2rem",
      fontWeight: "bold",
      letterSpacing: "0.1rem",
      textAlign: center ? "center" : "left",
    }}>{title}</Display>
    <div style={{
      ...stylesheet.RowFlex,
      justifyContent: center ? "center" : "left",
      marginTop: "1rem",
    }}>
      {
        pills.map(e => <Pill key={e}>{e}</Pill>)
      }
    </div>
    <div style={{
      fontSize: "1rem",
      textAlign: "justify",
      color: "#4f4f4f",
      marginTop: "1rem",
    }}>
      {content}
    </div>
  </div>
}