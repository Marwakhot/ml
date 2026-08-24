export interface SampleDataset {
  name: string;
  filename: string;
  description: string;
  defaultTarget: string;
  csv: string;
}

export const SAMPLE_DATASETS: SampleDataset[] = [
  {
    name: "Iris Flower Classification",
    filename: "iris_dataset.csv",
    description: "Classic 3-class classification with 4 numerical biometric features.",
    defaultTarget: "species",
    csv: `sepal_length,sepal_width,petal_length,petal_width,species
5.1,3.5,1.4,0.2,setosa
4.9,3.0,1.4,0.2,setosa
4.7,3.2,1.3,0.2,setosa
4.6,3.1,1.5,0.2,setosa
5.0,3.6,1.4,0.2,setosa
5.4,3.9,1.7,0.4,setosa
4.6,3.4,1.4,0.3,setosa
5.0,3.4,1.5,0.2,setosa
4.4,2.9,1.4,0.2,setosa
4.9,3.1,1.5,0.1,setosa
5.4,3.7,1.5,0.2,setosa
4.8,3.4,1.6,0.2,setosa
4.8,3.0,1.4,0.1,setosa
4.3,3.0,1.1,0.1,setosa
5.8,4.0,1.2,0.2,setosa
5.7,4.4,1.5,0.4,setosa
5.4,3.9,1.3,0.4,setosa
5.1,3.5,1.4,0.3,setosa
5.7,3.8,1.7,0.3,setosa
5.1,3.8,1.5,0.3,setosa
7.0,3.2,4.7,1.4,versicolor
6.4,3.2,4.5,1.5,versicolor
6.9,3.1,4.9,1.5,versicolor
5.5,2.3,4.0,1.3,versicolor
6.5,2.8,4.6,1.5,versicolor
5.7,2.8,4.5,1.3,versicolor
6.3,3.3,4.7,1.6,versicolor
4.9,2.4,3.3,1.0,versicolor
6.6,2.9,4.6,1.3,versicolor
5.2,2.7,3.9,1.4,versicolor
5.0,2.0,3.5,1.0,versicolor
5.9,3.0,4.2,1.5,versicolor
6.0,2.2,4.0,1.0,versicolor
6.1,2.9,4.7,1.4,versicolor
5.6,2.9,3.6,1.3,versicolor
6.7,3.1,4.4,1.4,versicolor
5.6,3.0,4.5,1.5,versicolor
5.8,2.7,4.1,1.0,versicolor
6.2,2.2,4.5,1.5,versicolor
5.6,2.5,3.9,1.1,versicolor
6.3,3.3,6.0,2.5,virginica
5.8,2.7,5.1,1.9,virginica
7.1,3.0,5.9,2.1,virginica
6.3,2.9,5.6,1.8,virginica
6.5,3.0,5.8,2.2,virginica
7.6,3.0,6.6,2.1,virginica
4.9,2.5,4.5,1.7,virginica
7.3,2.9,6.3,1.8,virginica
6.7,2.5,5.8,1.8,virginica
7.2,3.6,6.1,2.5,virginica
6.5,3.2,5.1,2.0,virginica
6.4,2.7,5.3,1.9,virginica
6.8,3.0,5.5,2.1,virginica
5.7,2.5,5.0,2.0,virginica
5.8,2.8,5.1,2.4,virginica
6.4,3.2,5.3,2.3,virginica
6.5,3.0,5.5,1.8,virginica
7.7,3.8,6.7,2.2,virginica
7.7,2.6,6.9,2.3,virginica
6.0,2.2,5.0,1.5,virginica`,
  },
  {
    name: "Customer Churn Prediction",
    filename: "customer_churn.csv",
    description: "Binary classification with mixed categorical and numeric customer signals.",
    defaultTarget: "churn",
    csv: `account_length,international_plan,voice_mail_plan,number_vmail_messages,total_day_minutes,total_day_calls,customer_service_calls,churn
128,no,yes,25,265.1,110,1,no
107,no,yes,26,161.6,123,1,no
137,no,no,0,243.4,114,0,no
84,yes,no,0,299.4,71,2,no
75,yes,no,0,166.7,113,3,no
118,yes,no,0,223.4,98,0,no
121,no,yes,24,218.2,88,3,no
147,yes,no,0,157.0,79,0,no
117,no,no,0,184.5,97,1,no
141,yes,yes,37,258.6,84,0,no
65,no,no,0,129.1,137,4,yes
74,no,no,0,187.7,127,2,no
168,no,no,0,128.8,96,1,no
95,no,no,0,156.6,88,3,no
62,no,no,0,120.7,70,1,no
161,no,no,0,332.9,67,4,yes
85,no,yes,27,196.4,139,1,no
93,no,no,0,190.7,114,3,no
76,no,yes,33,189.7,66,1,no
73,no,no,0,224.4,90,1,no
147,no,no,0,155.1,117,0,yes
77,no,no,0,62.4,89,5,yes
130,no,no,0,183.0,112,0,no
111,no,no,0,110.4,103,2,no
132,no,no,0,81.1,86,0,no
174,no,no,0,124.3,76,3,no
57,no,yes,39,213.0,115,0,no
54,no,no,0,134.3,73,3,no
20,no,no,0,190.0,109,0,no
142,no,no,0,87.0,88,5,yes
69,no,no,0,129.8,78,1,no
77,no,no,0,124.6,121,5,yes
172,no,no,0,212.0,121,3,no
12,no,no,0,249.6,118,1,yes
57,no,yes,25,176.8,94,0,no
72,no,yes,37,220.0,102,1,no
68,no,no,0,157.0,100,2,no
86,no,no,0,123.5,88,1,no
136,yes,yes,33,203.9,106,1,no
149,no,no,0,140.4,94,1,no
166,no,no,0,260.7,93,1,yes
135,yes,yes,41,173.1,85,2,no
36,no,yes,29,146.9,110,0,no
78,no,no,0,130.8,64,5,yes
121,no,no,0,170.8,98,1,no
98,no,no,0,288.1,112,1,yes
135,no,no,0,251.2,108,1,no
152,no,no,0,196.4,43,2,no
97,no,no,0,252.6,89,2,no
215,no,no,0,83.6,148,0,no`,
  },
];
