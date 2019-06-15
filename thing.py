secret=['y','a','d','o','t','u','o','y','d','e','s','s','i','m','e','w']
secret.insert(5,' ' )
secret.insert(9,' ' )
secret.insert(16,' ' )
LEN=len(secret)
for i in range(LEN//2):
    secret[i],secret[LEN-i-1]=secret[LEN-i-1],secret[i]
cnt=1
sec2=secret[0]
while cnt < LEN:
    sec1=secret[cnt]
    sec2+=sec1
    cnt+=1
print(sec2)
