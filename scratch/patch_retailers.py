import re

with open('mobile/src/pages/shared/RetailersDirectory.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update RetailerCard signature
code = code.replace(
    "const RetailerCard = React.memo(({ r, user, repName, repId, outst, creditLimit, spendable, segment, ordersCount, outstColor, badgeBg, badgeColor, targetValue, achievedValue, onOpenProfile, onOpenRewards, onDelete, onOrder, handleSaveCreditLimit }) => {",
    "const RetailerCard = React.memo(({ r, user, repName, repId, outst, creditLimit, spendable, segment, ordersCount, outstColor, badgeBg, badgeColor, targetValue, achievedValue, onDelete, onOrder, handleSaveCreditLimit, availableDistricts, onSaveProfile, onSaveRewards, rewardsData }) => {"
)

# 2. Update states inside RetailerCard
states_old = """  const [flipped, setFlipped] = useState(false);
  const [flipContext, setFlipContext] = useState(null);
  const flipAnim = useRef(new Animated.Value(0)).current;

  // Edit States
  const [editingCredit, setEditingCredit] = useState(false);
  const [editLimit, setEditLimit] = useState(String(creditLimit));
  
  const [rewardsForm, setRewardsForm] = useState({target1: '150', rewardName1: 'Silver Tier Trip', target2: '280', rewardName2: 'Gold Tier Trip (Dubai)'});
  const [savingRewards, setSavingRewards] = useState(false);"""

states_new = """  const [flipped, setFlipped] = useState(false);
  const [flipContext, setFlipContext] = useState(null);
  const flipAnim = useRef(new Animated.Value(0)).current;

  // Edit States
  const [editingCredit, setEditingCredit] = useState(false);
  const [editLimit, setEditLimit] = useState(String(creditLimit));
  
  const [profileForm, setProfileForm] = useState({ Name: r.Name || '', Company: r.Company || '', Phone: r.Phone || '', City: r.City || '', District: r.District || '', Segment: r.Segment || (r.NonTradeActivated ? 'Non-Trade' : 'Trade') });
  const [savingProfile, setSavingProfile] = useState(false);

  const [rewardsForm, setRewardsForm] = useState({
    startDate: rewardsData?.startDate || '',
    endDate: rewardsData?.endDate || '',
    target1: rewardsData?.targets?.[0]?.target?.toString() || '',
    rewardName1: rewardsData?.targets?.[0]?.rewardName || '',
    target2: rewardsData?.targets?.[1]?.target?.toString() || '',
    rewardName2: rewardsData?.targets?.[1]?.rewardName || ''
  });
  const [savingRewards, setSavingRewards] = useState(false);"""

code = code.replace(states_old, states_new)

# 3. Replace renderBack
render_back_old = """  const renderBack = () => (
    <Animated.View style={[styles.cardFace, styles.cardFaceBack, { transform: [{ rotateY: backInterpolate }] }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{flipContext === 'rewards' ? 'Edit Rewards' : 'Edit Details'}</Text>
        <TouchableOpacity onPress={() => flipTo(0, null)}><X size={20} color="#8E8E93" /></TouchableOpacity>
      </View>
      
      <ScrollView style={{flex:1}}>
        {flipContext === 'rewards' ? (
          <View style={{gap: 12}}>
            <Text style={styles.infoLabel}>Currently editable in web version</Text>
            <Text style={styles.infoValue}>Full rewards management coming soon to mobile.</Text>
          </View>
        ) : (
          <View style={{gap: 12}}>
            <Text style={styles.infoLabel}>Currently editable in web version</Text>
            <Text style={styles.infoValue}>Full profile editing coming soon to mobile.</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.actionRowEnd}>
        <TouchableOpacity onPress={() => flipTo(0, null)} style={styles.cancelBtn}><Text style={{color:'#1A1A1A', fontWeight:'600'}}>Cancel</Text></TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn}><Text style={{color:'#FFF', fontWeight:'600'}}>Save</Text></TouchableOpacity>
      </View>
    </Animated.View>
  );"""

render_back_new = """  const renderBack = () => (
    <Animated.View style={[styles.cardFace, styles.cardFaceBack, { transform: [{ rotateY: backInterpolate }] }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{flipContext === 'rewards' ? 'Edit Rewards' : 'Edit Details'}</Text>
        <TouchableOpacity onPress={() => flipTo(0, null)}><X size={20} color="#8E8E93" /></TouchableOpacity>
      </View>
      
      <ScrollView style={{flex:1, marginBottom: 12}}>
        {flipContext === 'rewards' ? (
          <View style={{gap: 12}}>
            <View>
              <Text style={styles.formLabel}>Start Date</Text>
              <TextInput style={styles.formInput} value={rewardsForm.startDate} onChangeText={t => setRewardsForm({...rewardsForm, startDate: t})} placeholder="YYYY-MM-DD" />
            </View>
            <View>
              <Text style={styles.formLabel}>End Date</Text>
              <TextInput style={styles.formInput} value={rewardsForm.endDate} onChangeText={t => setRewardsForm({...rewardsForm, endDate: t})} placeholder="YYYY-MM-DD" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formGroupTitle}>Target 1 (Silver)</Text>
              <TextInput style={styles.formInput} value={rewardsForm.target1} onChangeText={t => setRewardsForm({...rewardsForm, target1: t})} placeholder="Qty (Tons)" keyboardType="numeric" />
              <TextInput style={[styles.formInput, {marginTop: 8}]} value={rewardsForm.rewardName1} onChangeText={t => setRewardsForm({...rewardsForm, rewardName1: t})} placeholder="Reward Name" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formGroupTitle}>Target 2 (Gold)</Text>
              <TextInput style={styles.formInput} value={rewardsForm.target2} onChangeText={t => setRewardsForm({...rewardsForm, target2: t})} placeholder="Qty (Tons)" keyboardType="numeric" />
              <TextInput style={[styles.formInput, {marginTop: 8}]} value={rewardsForm.rewardName2} onChangeText={t => setRewardsForm({...rewardsForm, rewardName2: t})} placeholder="Reward Name" />
            </View>
          </View>
        ) : (
          <View style={{gap: 12}}>
            <View>
              <Text style={styles.formLabel}>Name</Text>
              <TextInput style={styles.formInput} value={profileForm.Name} onChangeText={t => setProfileForm({...profileForm, Name: t})} />
            </View>
            <View>
              <Text style={styles.formLabel}>Company</Text>
              <TextInput style={styles.formInput} value={profileForm.Company} onChangeText={t => setProfileForm({...profileForm, Company: t})} />
            </View>
            <View style={{flexDirection: 'row', gap: 12}}>
              <View style={{flex:1}}>
                <Text style={styles.formLabel}>Phone</Text>
                <TextInput style={styles.formInput} value={profileForm.Phone} onChangeText={t => setProfileForm({...profileForm, Phone: t})} keyboardType="phone-pad" />
              </View>
              <View style={{flex:1}}>
                <Text style={styles.formLabel}>City</Text>
                <TextInput style={styles.formInput} value={profileForm.City} onChangeText={t => setProfileForm({...profileForm, City: t})} />
              </View>
            </View>
            <View>
              <Text style={styles.formLabel}>District</Text>
              <TextInput style={styles.formInput} value={profileForm.District} onChangeText={t => setProfileForm({...profileForm, District: t})} />
            </View>
            <View>
              <Text style={styles.formLabel}>Segment (Trade / Non-Trade)</Text>
              <TextInput style={styles.formInput} value={profileForm.Segment} onChangeText={t => setProfileForm({...profileForm, Segment: t})} />
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.actionRowEnd}>
        <TouchableOpacity onPress={() => flipTo(0, null)} style={styles.cancelBtn}><Text style={{color:'#1A1A1A', fontWeight:'600'}}>Cancel</Text></TouchableOpacity>
        <TouchableOpacity 
          style={[styles.saveBtn, (savingProfile || savingRewards) && {opacity:0.7}]} 
          onPress={async () => {
            if (flipContext === 'profile') {
              setSavingProfile(true);
              try {
                await onSaveProfile(r.UserID, profileForm);
                flipTo(0, null);
              } finally {
                setSavingProfile(false);
              }
            } else {
              setSavingRewards(true);
              try {
                await onSaveRewards(r.UserID, rewardsForm);
                flipTo(0, null);
              } finally {
                setSavingRewards(false);
              }
            }
          }}
          disabled={savingProfile || savingRewards}
        >
          <Text style={{color:'#FFF', fontWeight:'600'}}>{(savingProfile || savingRewards) ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );"""

code = code.replace(render_back_old, render_back_new)

# 4. Update renderRetailerItem
render_item_old = """      <RetailerCard
        r={r} user={user}
        repName={repId ? (salesRepsMap[repId] || 'Unknown Rep') : 'Unassigned'} repId={repId}
        outst={outst} creditLimit={creditLimit} spendable={spendable} segment={segment}
        ordersCount={agg.count} outstColor={outst === 0 ? '#34C759' : '#F59E0B'}
        badgeBg={isNonTrade ? '#F3E8FF' : '#E0F2FE'} badgeColor={isNonTrade ? '#9333EA' : '#0284C7'}
        targetValue={rewardsMap[r.UserID]?.targets?.[1]?.target || 280} achievedValue={agg.achievedValue}
        onDelete={handleDeleteCustomer} onOrder={handleOrder} handleSaveCreditLimit={handleSaveCreditLimit}
      />"""

render_item_new = """      <RetailerCard
        r={r} user={user}
        repName={repId ? (salesRepsMap[repId] || 'Unknown Rep') : 'Unassigned'} repId={repId}
        outst={outst} creditLimit={creditLimit} spendable={spendable} segment={segment}
        ordersCount={agg.count} outstColor={outst === 0 ? '#34C759' : '#F59E0B'}
        badgeBg={isNonTrade ? '#F3E8FF' : '#E0F2FE'} badgeColor={isNonTrade ? '#9333EA' : '#0284C7'}
        targetValue={rewardsMap[r.UserID]?.targets?.[1]?.target || 280} achievedValue={agg.achievedValue}
        onDelete={handleDeleteCustomer} onOrder={handleOrder} handleSaveCreditLimit={handleSaveCreditLimit}
        availableDistricts={availableDistricts} onSaveProfile={handleSaveProfile} onSaveRewards={handleSaveRewards}
        rewardsData={rewardsMap[r.UserID]}
      />"""

code = code.replace(render_item_old, render_item_new)

with open('mobile/src/pages/shared/RetailersDirectory.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Patched successfully")
