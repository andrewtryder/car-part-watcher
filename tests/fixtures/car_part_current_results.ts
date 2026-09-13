/** Sanitized current Car-Part results layout; no session or transient source state. */
export const currentResultsFixture = `<table>
  <tr><td>Year<br>Part<br>Model</td><td>Description</td><td>Damage<br>Code</td><td>Part Grade</td><td>Stock#</td><td>US<br>Price</td><td>Dealer Info</td><td>Dist<br>mile</td></tr>
  <tr>
    <td>2019<br>Front Bumper Assembly<br>Honda CRV</td>
    <td><a href="https://imageappoh.car-part.com/image?partGUID=part-1&amp;partsourceid=1004&amp;vehicleGUID=vehicle-1&amp;seller=1004"><img src="https://wsimgoh.car-part.com/1004/a_thumb.jpg"></a> Complete, foglights included, damage. Estimated CO2e Savings: 96kg</td>
    <td>6S55D4</td><td>C9cc</td><td>799239</td><td>$380<a href="/">actual</a></td>
    <td><a href="https://example-recycler.test">Example Recycler</a> USA-NH(Concord) <a href="/cgi-bin/quoteForm.cgi?type=g&amp;selleruserid=1004&amp;tk1=secret&amp;sessionID=transient&amp;seqNum=1">Request_Quote</a> 800-555-1212</td><td>27</td>
  </tr>
  <tr>
    <td>2018<br>Front Bumper Assembly<br>Honda CRV</td><td>W/ fog lamps</td><td>000</td><td>A0</td><td>FKC062</td><td>Call</td>
    <td><a href="https://another-recycler.test">Another Recycler</a> USA-ME(Portland) 207-555-2222</td><td>81</td>
  </tr>
</table>`;
