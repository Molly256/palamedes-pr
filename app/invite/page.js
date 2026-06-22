const VIPS = [
  { level: 1, perBook: 625, books: 4 },
  { level: 2, perBook: 2000, books: 4 },
  { level: 3, perBook: 6500, books: 4 },
  { level: 4, perBook: 7000, books: 5 },
  { level: 5, perBook: 10000, books: 5 },
  { level: 6, perBook: 14000, books: 5 },
  { level: 7, perBook: 28000, books: 5 },
  { level: 8, perBook: 32000, books: 5 },
  { level: 9, perBook: 40000, books: 5 },
  { level: 10, perBook: 60000, books: 5 },
]

return (
  <table>
    <thead>
      <tr>
        <th>VIP</th>
        <th>Books/Day</th>
        <th>Per Book</th>
        <th>Daily Earning</th>
      </tr>
    </thead>
    <tbody>
      {VIPS.map(vip => (
        <tr key={vip.level}>
          <td>VIP {vip.level}</td>
          <td>{vip.books}</td>
          <td>{vip.perBook.toLocaleString()} shs</td>
          <td>{(vip.perBook * vip.books).toLocaleString()} shs</td>
        </tr>
      ))}
    </tbody>
  </table>
)